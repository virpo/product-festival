create extension if not exists pgcrypto;

create type public.event_status as enum ('draft', 'open', 'locked', 'released');
create type public.person_role as enum ('participant', 'mentor', 'organizer', 'observer');

create table public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status public.event_status not null default 'draft',
  currency text not null default '€',
  wallet_default integer not null default 100 check (wallet_default >= 0),
  max_per_team integer not null default 50 check (max_per_team >= 0),
  coverage_target integer not null default 75 check (coverage_target between 0 and 100),
  opens_at timestamptz,
  locks_at timestamptz,
  results_released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  number integer not null check (number > 0),
  name text not null,
  slug text not null,
  code text not null,
  description text not null default '',
  product_url text,
  table_label text not null default '',
  color text not null default '#62c5c0',
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  unique (event_id, number),
  unique (event_id, slug),
  unique (event_id, code)
);

create table public.people (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  role public.person_role not null default 'participant',
  wallet_budget integer not null default 100 check (wallet_budget >= 0),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

-- Access codes are deliberately separate. A released receipt may expose an
-- author's name, but never the credential they used to enter the event.
create table public.access_codes (
  person_id uuid primary key references public.people(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  code text not null,
  unique (event_id, code)
);

create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  unique (event_id, person_id)
);

create table public.visits (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  first_visited_at timestamptz not null default now(),
  last_visited_at timestamptz not null default now(),
  unique (event_id, person_id, team_id)
);

create table public.signals (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  investor_id uuid not null references public.people(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  amount integer not null default 0 check (amount >= 0),
  feedback_text text not null default '',
  audio_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, investor_id, team_id),
  check (length(trim(feedback_text)) > 0 or audio_path is not null)
);

create table public.event_stats (
  event_id uuid primary key references public.events(id) on delete cascade,
  people_count integer not null default 0,
  active_people integer not null default 0,
  team_count integer not null default 0,
  visit_count integer not null default 0,
  signal_count integer not null default 0,
  feedback_count integer not null default 0,
  recording_count integer not null default 0,
  total_invested integer not null default 0,
  coverage_qualified_people integer not null default 0,
  coverage_percent integer not null default 0,
  average_coverage numeric(8, 2) not null default 0,
  role_participation jsonb not null default '{"participant":0,"mentor":0,"organizer":0,"observer":0}'::jsonb,
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger events_set_updated_at
before update on public.events
for each row execute function public.set_updated_at();

create trigger signals_set_updated_at
before update on public.signals
for each row execute function public.set_updated_at();

create or replace function public.current_person_id(target_event_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.people
  where event_id = target_event_id
    and auth_user_id = auth.uid()
  limit 1;
$$;

create or replace function public.is_organizer(target_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.people
    where event_id = target_event_id
      and auth_user_id = auth.uid()
      and role = 'organizer'
  );
$$;

create or replace function public.can_view_team_receipt(
  target_event_id uuid,
  target_team_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_organizer(target_event_id)
    or (
      exists (
        select 1 from public.events
        where id = target_event_id and status = 'released'
      )
      and exists (
        select 1 from public.team_members
        where event_id = target_event_id
          and team_id = target_team_id
          and person_id = public.current_person_id(target_event_id)
      )
    );
$$;

create or replace function public.can_view_person(
  target_event_id uuid,
  target_person_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_person_id = public.current_person_id(target_event_id)
    or public.is_organizer(target_event_id)
    or exists (
      select 1
      from public.signals s
      where s.event_id = target_event_id
        and s.investor_id = target_person_id
        and public.can_view_team_receipt(target_event_id, s.team_id)
    );
$$;

create or replace function public.claim_person(
  claim_code text,
  claim_event_slug text
)
returns table (
  id uuid,
  event_id uuid,
  name text,
  role public.person_role,
  wallet_budget integer,
  access_code text,
  auth_user_id uuid,
  last_seen_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed_person public.people%rowtype;
  normalized_code text := upper(trim(claim_code));
begin
  if auth.uid() is null then
    raise exception 'Anonymous authentication is required.';
  end if;

  select p.*
  into claimed_person
  from public.people p
  join public.events e on e.id = p.event_id
  join public.access_codes ac on ac.person_id = p.id
  where e.slug = claim_event_slug
    and upper(ac.code) = normalized_code
  for update of p;

  if claimed_person.id is null then
    raise exception 'Unknown access code.';
  end if;

  if claimed_person.auth_user_id is not null
    and claimed_person.auth_user_id <> auth.uid() then
    raise exception 'This access code is already in use.';
  end if;

  update public.people p
  set auth_user_id = auth.uid(), last_seen_at = now()
  where p.id = claimed_person.id
  returning p.* into claimed_person;

  return query
  select
    claimed_person.id,
    claimed_person.event_id,
    claimed_person.name,
    claimed_person.role,
    claimed_person.wallet_budget,
    normalized_code,
    claimed_person.auth_user_id,
    claimed_person.last_seen_at,
    claimed_person.created_at;
end;
$$;

create or replace function public.release_current_person(target_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.people
  set auth_user_id = null
  where event_id = target_event_id and auth_user_id = auth.uid();
end;
$$;

create or replace function public.advance_event(
  target_event_id uuid,
  target_status public.event_status
)
returns public.events
language plpgsql
security definer
set search_path = public
as $$
declare
  current_event public.events%rowtype;
  expected_status public.event_status;
begin
  if not public.is_organizer(target_event_id) then
    raise exception 'Organizer access required.';
  end if;

  select * into current_event
  from public.events
  where id = target_event_id
  for update;

  expected_status := case current_event.status
    when 'draft' then 'open'::public.event_status
    when 'open' then 'locked'::public.event_status
    when 'locked' then 'released'::public.event_status
    else null
  end;

  if expected_status is null or target_status <> expected_status then
    raise exception 'Invalid event transition.';
  end if;

  update public.events
  set
    status = target_status,
    opens_at = case when target_status = 'open' then now() else opens_at end,
    results_released_at = case
      when target_status = 'released' then now()
      else results_released_at
    end
  where id = target_event_id
  returning * into current_event;

  return current_event;
end;
$$;

create or replace function public.save_signal(
  signal_event_id uuid,
  signal_team_id uuid,
  signal_amount integer,
  signal_feedback_text text,
  signal_audio_path text default null
)
returns public.signals
language plpgsql
security definer
set search_path = public
as $$
declare
  event_row public.events%rowtype;
  investor_row public.people%rowtype;
  saved_signal public.signals%rowtype;
  already_spent integer;
begin
  select * into event_row
  from public.events
  where id = signal_event_id
  for update;

  if event_row.status <> 'open' then
    raise exception 'Investing is closed.';
  end if;

  select * into investor_row
  from public.people
  where event_id = signal_event_id and auth_user_id = auth.uid();

  if investor_row.id is null then
    raise exception 'Claim an access code first.';
  end if;

  if not exists (
    select 1 from public.teams
    where id = signal_team_id
      and event_id = signal_event_id
      and archived = false
  ) then
    raise exception 'Team is not available.';
  end if;

  if exists (
    select 1 from public.team_members
    where event_id = signal_event_id
      and team_id = signal_team_id
      and person_id = investor_row.id
  ) then
    raise exception 'You cannot invest in your own team.';
  end if;

  if signal_amount < 0
    or signal_amount > event_row.max_per_team then
    raise exception 'Invalid amount.';
  end if;

  if length(trim(coalesce(signal_feedback_text, ''))) = 0
    and signal_audio_path is null then
    raise exception 'Feedback or a recording is required.';
  end if;

  select coalesce(sum(amount), 0)::integer
  into already_spent
  from public.signals
  where event_id = signal_event_id
    and investor_id = investor_row.id
    and team_id <> signal_team_id;

  if already_spent + signal_amount > investor_row.wallet_budget then
    raise exception 'Not enough credit.';
  end if;

  insert into public.signals (
    event_id,
    investor_id,
    team_id,
    amount,
    feedback_text,
    audio_path
  )
  values (
    signal_event_id,
    investor_row.id,
    signal_team_id,
    signal_amount,
    trim(coalesce(signal_feedback_text, '')),
    signal_audio_path
  )
  on conflict (event_id, investor_id, team_id)
  do update set
    amount = excluded.amount,
    feedback_text = excluded.feedback_text,
    audio_path = excluded.audio_path
  returning * into saved_signal;

  return saved_signal;
end;
$$;

create or replace function public.remove_signal(
  signal_event_id uuid,
  signal_team_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.events
    where id = signal_event_id and status = 'open'
  ) then
    raise exception 'Investing is closed.';
  end if;

  delete from public.signals
  where event_id = signal_event_id
    and team_id = signal_team_id
    and investor_id = public.current_person_id(signal_event_id);
end;
$$;

create or replace function public.remove_team(target_team_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_event_id uuid;
begin
  select event_id into target_event_id from public.teams where id = target_team_id;
  if not public.is_organizer(target_event_id) then
    raise exception 'Organizer access required.';
  end if;

  if exists (select 1 from public.signals where team_id = target_team_id) then
    update public.teams set archived = true where id = target_team_id;
  else
    delete from public.teams where id = target_team_id;
  end if;
end;
$$;

create or replace function public.refresh_event_stats(target_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_coverage integer;
begin
  select coverage_target into target_coverage
  from public.events where id = target_event_id;

  insert into public.event_stats (
    event_id,
    people_count,
    active_people,
    team_count,
    visit_count,
    signal_count,
    feedback_count,
    recording_count,
    total_invested,
    coverage_qualified_people,
    coverage_percent,
    average_coverage,
    role_participation,
    updated_at
  )
  with participation as (
    select
      p.role,
      count(*) filter (
        where exists (
          select 1 from public.visits v where v.person_id = p.id
        ) or exists (
          select 1 from public.signals s where s.investor_id = p.id
        )
      )::integer as count
    from public.people p
    where p.event_id = target_event_id
    group by p.role
  ),
  coverage as (
    select
      p.id,
      (
        select count(*)
        from public.teams t
        where t.event_id = target_event_id
          and t.archived = false
          and not exists (
            select 1 from public.team_members tm
            where tm.team_id = t.id and tm.person_id = p.id
          )
      )::integer as available,
      (
        select count(distinct v.team_id)
        from public.visits v
        where v.event_id = target_event_id
          and v.person_id = p.id
          and not exists (
            select 1 from public.team_members tm
            where tm.team_id = v.team_id and tm.person_id = p.id
          )
      )::integer as visited
    from public.people p
    where p.event_id = target_event_id
  )
  select
    target_event_id,
    (select count(*)::integer from public.people where event_id = target_event_id),
    (
      select count(*)::integer from public.people
      where event_id = target_event_id
        and last_seen_at > now() - interval '10 minutes'
    ),
    (
      select count(*)::integer from public.teams
      where event_id = target_event_id and archived = false
    ),
    (select count(*)::integer from public.visits where event_id = target_event_id),
    (select count(*)::integer from public.signals where event_id = target_event_id),
    (
      select count(*)::integer from public.signals
      where event_id = target_event_id
        and (length(trim(feedback_text)) > 0 or audio_path is not null)
    ),
    (
      select count(*)::integer from public.signals
      where event_id = target_event_id and audio_path is not null
    ),
    (
      select coalesce(sum(amount), 0)::integer
      from public.signals where event_id = target_event_id
    ),
    (
      select count(*)::integer
      from coverage
      where available = 0
        or visited >= ceil(available * target_coverage / 100.0)
    ),
    (
      select case when count(*) = 0 then 0 else round(
        100.0 * count(*) filter (
          where available = 0
            or visited >= ceil(available * target_coverage / 100.0)
        ) / count(*)
      )::integer end
      from coverage
    ),
    (select coalesce(round(avg(visited), 2), 0) from coverage),
    jsonb_build_object(
      'participant', coalesce((select count from participation where role = 'participant'), 0),
      'mentor', coalesce((select count from participation where role = 'mentor'), 0),
      'organizer', coalesce((select count from participation where role = 'organizer'), 0),
      'observer', coalesce((select count from participation where role = 'observer'), 0)
    ),
    now()
  on conflict (event_id)
  do update set
    people_count = excluded.people_count,
    active_people = excluded.active_people,
    team_count = excluded.team_count,
    visit_count = excluded.visit_count,
    signal_count = excluded.signal_count,
    feedback_count = excluded.feedback_count,
    recording_count = excluded.recording_count,
    total_invested = excluded.total_invested,
    coverage_qualified_people = excluded.coverage_qualified_people,
    coverage_percent = excluded.coverage_percent,
    average_coverage = excluded.average_coverage,
    role_participation = excluded.role_participation,
    updated_at = excluded.updated_at;
end;
$$;

create or replace function public.refresh_event_stats_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_event_stats(coalesce(new.event_id, old.event_id));
  return coalesce(new, old);
end;
$$;

create trigger teams_refresh_stats
after insert or update or delete on public.teams
for each row execute function public.refresh_event_stats_trigger();

create trigger people_refresh_stats
after insert or update or delete on public.people
for each row execute function public.refresh_event_stats_trigger();

create trigger team_members_refresh_stats
after insert or update or delete on public.team_members
for each row execute function public.refresh_event_stats_trigger();

create trigger visits_refresh_stats
after insert or update or delete on public.visits
for each row execute function public.refresh_event_stats_trigger();

create trigger signals_refresh_stats
after insert or update or delete on public.signals
for each row execute function public.refresh_event_stats_trigger();

alter table public.events enable row level security;
alter table public.teams enable row level security;
alter table public.people enable row level security;
alter table public.access_codes enable row level security;
alter table public.team_members enable row level security;
alter table public.visits enable row level security;
alter table public.signals enable row level security;
alter table public.event_stats enable row level security;

create policy events_select_public
on public.events for select
to anon, authenticated
using (true);

create policy events_update_organizer
on public.events for update
to authenticated
using (public.is_organizer(id))
with check (public.is_organizer(id));

create policy teams_select_public
on public.teams for select
to anon, authenticated
using (true);

create policy teams_insert_organizer
on public.teams for insert
to authenticated
with check (public.is_organizer(event_id));

create policy teams_update_organizer
on public.teams for update
to authenticated
using (public.is_organizer(event_id))
with check (public.is_organizer(event_id));

create policy teams_delete_organizer
on public.teams for delete
to authenticated
using (public.is_organizer(event_id));

create policy people_select_authorized
on public.people for select
to authenticated
using (public.can_view_person(event_id, id));

create policy people_insert_organizer
on public.people for insert
to authenticated
with check (public.is_organizer(event_id));

create policy people_update_organizer_or_self
on public.people for update
to authenticated
using (public.is_organizer(event_id) or id = public.current_person_id(event_id))
with check (public.is_organizer(event_id) or id = public.current_person_id(event_id));

create policy people_delete_organizer
on public.people for delete
to authenticated
using (public.is_organizer(event_id));

create policy access_codes_select_organizer
on public.access_codes for select
to authenticated
using (public.is_organizer(event_id));

create policy access_codes_write_organizer
on public.access_codes for all
to authenticated
using (public.is_organizer(event_id))
with check (public.is_organizer(event_id));

create policy team_members_select_authorized
on public.team_members for select
to authenticated
using (
  public.is_organizer(event_id)
  or person_id = public.current_person_id(event_id)
  or public.can_view_team_receipt(event_id, team_id)
);

create policy team_members_write_organizer
on public.team_members for all
to authenticated
using (public.is_organizer(event_id))
with check (public.is_organizer(event_id));

create policy visits_select_own_or_organizer
on public.visits for select
to authenticated
using (
  person_id = public.current_person_id(event_id)
  or public.is_organizer(event_id)
);

create policy visits_insert_own
on public.visits for insert
to authenticated
with check (person_id = public.current_person_id(event_id));

create policy visits_update_own
on public.visits for update
to authenticated
using (person_id = public.current_person_id(event_id))
with check (person_id = public.current_person_id(event_id));

create policy signals_select_own_or_released_team
on public.signals for select
to authenticated
using (
  investor_id = public.current_person_id(event_id)
  or public.is_organizer(event_id)
  or public.can_view_team_receipt(event_id, team_id)
);

create policy event_stats_select_public
on public.event_stats for select
to anon, authenticated
using (true);

grant select on public.events, public.teams, public.event_stats to anon, authenticated;
grant select on public.people, public.access_codes, public.team_members, public.visits, public.signals to authenticated;
grant insert, update, delete on public.teams, public.people, public.access_codes, public.team_members, public.visits to authenticated;
grant execute on function public.claim_person(text, text) to authenticated;
grant execute on function public.release_current_person(uuid) to authenticated;
grant execute on function public.advance_event(uuid, public.event_status) to authenticated;
grant execute on function public.save_signal(uuid, uuid, integer, text, text) to authenticated;
grant execute on function public.remove_signal(uuid, uuid) to authenticated;
grant execute on function public.remove_team(uuid) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'festival-feedback',
  'festival-feedback',
  false,
  15728640,
  array['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/mpeg']
)
on conflict (id) do nothing;

create policy festival_audio_insert_own
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'festival-feedback'
  and split_part(name, '/', 2)::uuid = public.current_person_id(
    split_part(name, '/', 1)::uuid
  )
);

create policy festival_audio_select_authorized
on storage.objects for select
to authenticated
using (
  bucket_id = 'festival-feedback'
  and exists (
    select 1
    from public.signals s
    where s.audio_path = name
      and (
        s.investor_id = public.current_person_id(s.event_id)
        or public.is_organizer(s.event_id)
        or public.can_view_team_receipt(s.event_id, s.team_id)
      )
  )
);

create policy festival_audio_delete_own
on storage.objects for delete
to authenticated
using (
  bucket_id = 'festival-feedback'
  and split_part(name, '/', 2)::uuid = public.current_person_id(
    split_part(name, '/', 1)::uuid
  )
);

alter publication supabase_realtime add table public.events;
alter publication supabase_realtime add table public.event_stats;
