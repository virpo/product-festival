drop function if exists public.claim_person(text, text);

create function public.claim_person(
  claim_code text,
  claim_event_slug text,
  allow_takeover boolean default false
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
    raise exception 'anonymous_auth_required';
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
    raise exception 'unknown_access_code';
  end if;

  if claimed_person.auth_user_id is not null
    and claimed_person.auth_user_id <> auth.uid()
    and not allow_takeover then
    raise exception 'access_code_in_use';
  end if;

  update public.people
  set auth_user_id = auth.uid(), last_seen_at = now()
  where public.people.id = claimed_person.id
  returning public.people.* into claimed_person;

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

revoke all on function public.claim_person(text, text, boolean) from public, anon;
grant execute on function public.claim_person(text, text, boolean) to authenticated;

alter table public.access_codes
  add constraint access_codes_code_length
  check (char_length(trim(code)) between 1 and 24);

create unique index access_codes_event_normalized_code_key
  on public.access_codes (event_id, upper(trim(code)));

create function public.save_person(
  target_person_id uuid,
  target_event_id uuid,
  target_name text,
  target_role public.person_role,
  target_wallet_budget integer,
  target_access_code text,
  target_team_id uuid
)
returns public.people
language plpgsql
security definer
set search_path = public
as $$
declare
  saved_person public.people%rowtype;
  event_row public.events%rowtype;
  current_team_id uuid;
  caller_person_id uuid;
  normalized_code text := upper(trim(target_access_code));
begin
  if not public.is_organizer(target_event_id) then
    raise exception 'organizer_access_required';
  end if;

  select *
  into event_row
  from public.events
  where id = target_event_id
  for update;

  if event_row.id is null then
    raise exception 'event_not_found';
  end if;

  if char_length(trim(target_name)) = 0 then
    raise exception 'person_name_required';
  end if;

  if char_length(normalized_code) = 0
    or char_length(normalized_code) > 24 then
    raise exception 'invalid_access_code';
  end if;

  if target_wallet_budget < 0 then
    raise exception 'invalid_wallet_budget';
  end if;

  if target_team_id is not null
    and not exists (
      select 1
      from public.teams
      where id = target_team_id
        and event_id = target_event_id
        and archived = false
    ) then
    raise exception 'team_not_available';
  end if;

  caller_person_id := public.current_person_id(target_event_id);

  if target_person_id is null then
    insert into public.people (
      event_id,
      name,
      role,
      wallet_budget
    )
    values (
      target_event_id,
      trim(target_name),
      target_role,
      target_wallet_budget
    )
    returning * into saved_person;
  else
    select *
    into saved_person
    from public.people
    where id = target_person_id
      and event_id = target_event_id
    for update;

    if saved_person.id is null then
      raise exception 'person_not_found';
    end if;

    if saved_person.role = 'organizer'
      and target_role <> 'organizer'
      and saved_person.id = caller_person_id then
      raise exception 'current_organizer_role_required';
    end if;

    if saved_person.role = 'organizer'
      and target_role <> 'organizer'
      and (
        select count(*)
        from public.people
        where event_id = target_event_id
          and role = 'organizer'
      ) <= 1 then
      raise exception 'last_organizer_role_required';
    end if;

    select team_id
    into current_team_id
    from public.team_members
    where event_id = target_event_id
      and person_id = saved_person.id;

    if current_team_id is distinct from target_team_id
      and exists (
        select 1
        from public.signals
        where event_id = target_event_id
          and investor_id = saved_person.id
      ) then
      raise exception 'membership_locked_after_signal';
    end if;

    update public.people
    set
      name = trim(target_name),
      role = target_role,
      wallet_budget = target_wallet_budget
    where id = saved_person.id
    returning * into saved_person;
  end if;

  insert into public.access_codes (
    person_id,
    event_id,
    code
  )
  values (
    saved_person.id,
    target_event_id,
    normalized_code
  )
  on conflict (person_id)
  do update set
    event_id = excluded.event_id,
    code = excluded.code;

  delete from public.team_members
  where event_id = target_event_id
    and person_id = saved_person.id;

  if target_team_id is not null then
    insert into public.team_members (
      event_id,
      person_id,
      team_id
    )
    values (
      target_event_id,
      saved_person.id,
      target_team_id
    );
  end if;

  return saved_person;
end;
$$;

create function public.update_event_settings(
  target_event_id uuid,
  target_name text,
  target_currency text,
  target_wallet_default integer,
  target_max_per_team integer,
  target_coverage_target integer,
  target_locks_at timestamptz
)
returns public.events
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_event public.events%rowtype;
begin
  if not public.is_organizer(target_event_id) then
    raise exception 'organizer_access_required';
  end if;

  if char_length(trim(target_name)) = 0 then
    raise exception 'event_name_required';
  end if;

  if char_length(trim(target_currency)) = 0
    or char_length(trim(target_currency)) > 3 then
    raise exception 'invalid_currency';
  end if;

  if target_wallet_default < 0
    or target_max_per_team < 0
    or target_coverage_target not between 0 and 100 then
    raise exception 'invalid_event_settings';
  end if;

  update public.events
  set
    name = trim(target_name),
    currency = trim(target_currency),
    wallet_default = target_wallet_default,
    max_per_team = target_max_per_team,
    coverage_target = target_coverage_target,
    locks_at = target_locks_at
  where id = target_event_id
  returning * into updated_event;

  if updated_event.id is null then
    raise exception 'event_not_found';
  end if;

  return updated_event;
end;
$$;

create function public.record_visit(
  target_event_id uuid,
  target_team_id uuid
)
returns public.visits
language plpgsql
security definer
set search_path = public
as $$
declare
  event_row public.events%rowtype;
  team_row public.teams%rowtype;
  visitor_id uuid;
  saved_visit public.visits%rowtype;
begin
  select *
  into event_row
  from public.events
  where id = target_event_id
  for share;

  if event_row.id is null then
    raise exception 'event_not_found';
  end if;

  if event_row.status <> 'open' then
    raise exception 'visits_closed';
  end if;

  visitor_id := public.current_person_id(target_event_id);

  if visitor_id is null then
    raise exception 'claim_access_code_first';
  end if;

  select *
  into team_row
  from public.teams
  where id = target_team_id
    and event_id = target_event_id
  for share;

  if team_row.id is null or team_row.archived then
    raise exception 'team_not_available';
  end if;

  if exists (
    select 1
    from public.team_members
    where event_id = target_event_id
      and team_id = target_team_id
      and person_id = visitor_id
  ) then
    raise exception 'cannot_visit_own_team';
  end if;

  insert into public.visits (
    event_id,
    person_id,
    team_id
  )
  values (
    target_event_id,
    visitor_id,
    target_team_id
  )
  on conflict (event_id, person_id, team_id)
  do update set last_visited_at = now()
  returning * into saved_visit;

  return saved_visit;
end;
$$;

create or replace function public.remove_person(target_person_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_person public.people%rowtype;
  event_row public.events%rowtype;
  caller_person_id uuid;
begin
  select *
  into target_person
  from public.people
  where id = target_person_id;

  if target_person.id is null then
    return;
  end if;

  if not public.is_organizer(target_person.event_id) then
    raise exception 'organizer_access_required';
  end if;

  select *
  into event_row
  from public.events
  where id = target_person.event_id
  for update;

  caller_person_id := public.current_person_id(target_person.event_id);

  if target_person.id = caller_person_id then
    raise exception 'current_organizer_cannot_be_removed';
  end if;

  if target_person.role = 'organizer'
    and (
      select count(*)
      from public.people
      where event_id = target_person.event_id
        and role = 'organizer'
    ) <= 1 then
    raise exception 'last_organizer_cannot_be_removed';
  end if;

  if exists (
    select 1
    from public.signals
    where investor_id = target_person.id
  ) then
    raise exception 'person_with_feedback_cannot_be_removed';
  end if;

  delete from public.people
  where id = target_person.id;
end;
$$;

drop policy if exists events_update_organizer on public.events;
drop policy if exists people_insert_organizer on public.people;
drop policy if exists people_update_organizer on public.people;
drop policy if exists people_delete_organizer on public.people;
drop policy if exists access_codes_write_organizer on public.access_codes;
drop policy if exists team_members_write_organizer on public.team_members;
drop policy if exists visits_insert_own on public.visits;
drop policy if exists visits_update_own on public.visits;

revoke update on public.events from authenticated;
revoke insert, update, delete on public.people, public.access_codes, public.team_members, public.visits from authenticated;

revoke all on function public.save_person(uuid, uuid, text, public.person_role, integer, text, uuid) from public, anon;
revoke all on function public.update_event_settings(uuid, text, text, integer, integer, integer, timestamptz) from public, anon;
revoke all on function public.record_visit(uuid, uuid) from public, anon;
revoke all on function public.remove_person(uuid) from public, anon;

grant execute on function public.save_person(uuid, uuid, text, public.person_role, integer, text, uuid) to authenticated;
grant execute on function public.update_event_settings(uuid, text, text, integer, integer, integer, timestamptz) to authenticated;
grant execute on function public.record_visit(uuid, uuid) to authenticated;
grant execute on function public.remove_person(uuid) to authenticated;

alter publication supabase_realtime add table public.teams;
alter publication supabase_realtime add table public.people;
alter publication supabase_realtime add table public.team_members;
