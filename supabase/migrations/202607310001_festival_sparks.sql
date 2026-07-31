create table public.bonus_awards (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  achievement text not null,
  amount integer not null check (amount > 0),
  team_id uuid references public.teams(id) on delete set null,
  created_at timestamptz not null default now(),
  check (
    achievement in (
      'first-spark', 'team-joins-in', 'first-light', 'helpful-spotlight',
      'curious-explorer', 'festival-sweep', 'voice-of-the-festival'
    )
  )
);

create unique index bonus_awards_once_per_person
  on public.bonus_awards (event_id, person_id, achievement)
  where achievement <> 'helpful-spotlight';

create unique index bonus_awards_helpful_per_team
  on public.bonus_awards (event_id, person_id, achievement, team_id)
  where achievement = 'helpful-spotlight';

alter table public.bonus_awards enable row level security;
create policy bonus_awards_select_own
on public.bonus_awards for select
to authenticated

using (person_id = public.current_person_id(event_id));
grant select on public.bonus_awards to authenticated;

create or replace function public.refresh_bonus_budget()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_event_id uuid := coalesce(new.event_id, old.event_id);
  total_budget integer;
  distributed integer;
begin
  select coalesce(sum(p.wallet_budget), 0)::integer
    + coalesce((select sum(a.amount)::integer from public.bonus_awards a join public.people awardee on awardee.id = a.person_id where a.event_id = target_event_id and awardee.role <> 'organizer'), 0)
    into total_budget
  from public.people p
  where p.event_id = target_event_id and p.role <> 'organizer';
  select coalesce(sum(s.amount), 0)::integer into distributed
  from public.signals s
  join public.people p on p.id = s.investor_id
  where s.event_id = target_event_id and p.role <> 'organizer';
  update public.event_stats
  set budget_total = total_budget,
      budget_distributed = distributed,
      budget_remaining = greatest(total_budget - distributed, 0),
      budget_distributed_percent = case when total_budget = 0 then 0 else least(100, round(100.0 * distributed / total_budget)::integer) end,
      updated_at = now()
  where event_id = target_event_id;
  return coalesce(new, old);
end;
$$;

create trigger bonus_awards_refresh_budget
after insert or update or delete on public.bonus_awards
for each row execute function public.refresh_bonus_budget();

create or replace function public.sync_bonus_budget(target_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  total_budget integer;
  distributed integer;
begin
  select coalesce(sum(p.wallet_budget), 0)::integer
    + coalesce((select sum(a.amount)::integer from public.bonus_awards a join public.people awardee on awardee.id = a.person_id where a.event_id = target_event_id and awardee.role <> 'organizer'), 0)
    into total_budget
  from public.people p
  where p.event_id = target_event_id and p.role <> 'organizer';
  select coalesce(sum(s.amount), 0)::integer into distributed
  from public.signals s
  join public.people p on p.id = s.investor_id
  where s.event_id = target_event_id and p.role <> 'organizer';
  update public.event_stats
  set budget_total = total_budget,
      budget_distributed = distributed,
      budget_remaining = greatest(total_budget - distributed, 0),
      budget_distributed_percent = case when total_budget = 0 then 0 else least(100, round(100.0 * distributed / total_budget)::integer) end,
      updated_at = now()
  where event_id = target_event_id;
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
  perform public.sync_bonus_budget(coalesce(new.event_id, old.event_id));
  return coalesce(new, old);
end;
$$;

-- The event row lock serializes eligibility calculation and award insertion.
drop function if exists public.save_signal(uuid, uuid, integer, text, text);
create function public.save_signal(
  signal_event_id uuid,
  signal_team_id uuid,
  signal_amount integer,
  signal_feedback_text text,
  signal_audio_path text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  event_row public.events%rowtype;
  investor_row public.people%rowtype;
  saved_signal public.signals%rowtype;
  existing_signal public.signals%rowtype;
  already_spent integer;
  available integer;
  new_awards jsonb := '[]'::jsonb;
  own_team_ids uuid[];
  explored_team_count integer;
  minimum_reviews integer;
  candidate_reviews integer;
  achievement text;
  award_amount integer;
  award_title text;
  award_message text;
  signal_was_new boolean;
begin
  select * into event_row from public.events where id = signal_event_id for update;
  if event_row.status <> 'open' then raise exception 'Investing is closed.'; end if;

  select * into investor_row from public.people where event_id = signal_event_id and auth_user_id = auth.uid();
  if investor_row.id is null then raise exception 'Claim an access code first.'; end if;
  if not exists (select 1 from public.teams where id = signal_team_id and event_id = signal_event_id and archived = false) then raise exception 'Team is not available.'; end if;
  if exists (select 1 from public.team_members where event_id = signal_event_id and team_id = signal_team_id and person_id = investor_row.id) then raise exception 'You cannot invest in your own team.'; end if;
  if signal_amount < 0 or signal_amount > event_row.max_per_team then raise exception 'Invalid amount.'; end if;
  if length(trim(coalesce(signal_feedback_text, ''))) = 0 and signal_audio_path is null then raise exception 'Feedback or a recording is required.'; end if;

  select coalesce(sum(amount), 0)::integer into already_spent from public.signals where event_id = signal_event_id and investor_id = investor_row.id and team_id <> signal_team_id;
  select coalesce(sum(amount), 0)::integer into award_amount from public.bonus_awards where event_id = signal_event_id and person_id = investor_row.id;
  available := investor_row.wallet_budget + award_amount - already_spent;
  select * into existing_signal from public.signals where event_id = signal_event_id and investor_id = investor_row.id and team_id = signal_team_id;
  if signal_amount > available then raise exception 'Not enough credit.'; end if;

  insert into public.signals (event_id, investor_id, team_id, amount, feedback_text, audio_path)
  values (signal_event_id, investor_row.id, signal_team_id, signal_amount, trim(coalesce(signal_feedback_text, '')), signal_audio_path)
  on conflict (event_id, investor_id, team_id) do update set amount = excluded.amount, feedback_text = excluded.feedback_text, audio_path = excluded.audio_path
  returning * into saved_signal;
  signal_was_new := existing_signal.id is null;

  if signal_was_new then
    select array_agg(team_id) into own_team_ids from public.team_members where person_id = investor_row.id and event_id = signal_event_id;

    if not exists (select 1 from public.signals where event_id = signal_event_id and investor_id = investor_row.id and id <> saved_signal.id) then
      achievement := 'first-spark'; award_amount := 5; award_title := 'Prvá iskra!'; award_message := 'Tvoj prvý feedback rozžiaril festival.';
      insert into public.bonus_awards(event_id, person_id, achievement, amount) values (signal_event_id, investor_row.id, achievement, award_amount) on conflict do nothing;
      if found then new_awards := new_awards || jsonb_build_object('achievement', achievement, 'amount', award_amount, 'title', award_title, 'message', award_message); end if;
    end if;

    if own_team_ids is not null and not exists (select 1 from public.signals s join public.team_members tm on tm.person_id = s.investor_id and tm.team_id = any(own_team_ids) where s.event_id = signal_event_id and s.id <> saved_signal.id) then
      achievement := 'team-joins-in'; award_amount := 5; award_title := 'Tím sa pripája!'; award_message := 'Tvoj tím práve poslal svoju prvú iskru.';
      insert into public.bonus_awards(event_id, person_id, achievement, amount) values (signal_event_id, investor_row.id, achievement, award_amount) on conflict do nothing;
      if found then new_awards := new_awards || jsonb_build_object('achievement', achievement, 'amount', award_amount, 'title', award_title, 'message', award_message); end if;
    end if;

    if not exists (select 1 from public.signals where event_id = signal_event_id and team_id = signal_team_id and id <> saved_signal.id) then
      achievement := 'first-light'; award_amount := 10; award_title := 'Prvé svetlo!'; award_message := 'Tvoj feedback otvoril tomuto tímu nový pohľad.';
      insert into public.bonus_awards(event_id, person_id, achievement, amount) values (signal_event_id, investor_row.id, achievement, award_amount) on conflict do nothing;
      if found then new_awards := new_awards || jsonb_build_object('achievement', achievement, 'amount', award_amount, 'title', award_title, 'message', award_message); end if;
    end if;

    if event_row.opens_at is not null
      and event_row.locks_at is not null
      and event_row.locks_at > event_row.opens_at
      and now() >= event_row.opens_at + (event_row.locks_at - event_row.opens_at) / 2 then
      select min(review_count) into minimum_reviews from (select t.id, count(s.id)::integer review_count from public.teams t left join public.signals s on s.team_id = t.id and s.event_id = signal_event_id and s.id <> saved_signal.id where t.event_id = signal_event_id and t.archived = false and not exists (select 1 from public.team_members tm where tm.team_id = t.id and tm.person_id = investor_row.id) group by t.id) counts;
      select count(*)::integer into candidate_reviews from public.signals where event_id = signal_event_id and team_id = signal_team_id and id <> saved_signal.id;
      if candidate_reviews = minimum_reviews then
        achievement := 'helpful-spotlight'; award_amount := 10; award_title := 'Pomoc v centre pozornosti!'; award_message := 'Tvoj pohľad ide tímu, ktorý ho práve najviac potrebuje.';
        insert into public.bonus_awards(event_id, person_id, achievement, amount, team_id) values (signal_event_id, investor_row.id, achievement, award_amount, signal_team_id) on conflict do nothing;
        if found then new_awards := new_awards || jsonb_build_object('achievement', achievement, 'amount', award_amount, 'title', award_title, 'message', award_message); end if;
      end if;
    end if;

    select count(distinct s.team_id)::integer into explored_team_count from public.signals s where s.event_id = signal_event_id and s.investor_id = investor_row.id;
    if explored_team_count >= 3 then
      achievement := 'curious-explorer'; award_amount := 5; award_title := 'Zvedavý objaviteľ!'; award_message := 'Pozrel/a si sa na tri rôzne projekty.';
      insert into public.bonus_awards(event_id, person_id, achievement, amount) values (signal_event_id, investor_row.id, achievement, award_amount) on conflict do nothing;
      if found then new_awards := new_awards || jsonb_build_object('achievement', achievement, 'amount', award_amount, 'title', award_title, 'message', award_message); end if;
    end if;
    if not exists (
      select 1
      from public.teams t
      where t.event_id = signal_event_id
        and t.archived = false
        and not exists (
          select 1
          from public.team_members tm
          where tm.team_id = t.id and tm.person_id = investor_row.id
        )
        and not exists (
          select 1
          from public.signals s
          where s.event_id = signal_event_id
            and s.investor_id = investor_row.id
            and s.team_id = t.id
        )
    ) then
      achievement := 'festival-sweep'; award_amount := 20; award_title := 'Festivalová výprava!'; award_message := 'Dal/a si šancu každému cudziemu tímu.';
      insert into public.bonus_awards(event_id, person_id, achievement, amount) values (signal_event_id, investor_row.id, achievement, award_amount) on conflict do nothing;
      if found then new_awards := new_awards || jsonb_build_object('achievement', achievement, 'amount', award_amount, 'title', award_title, 'message', award_message); end if;
    end if;

    if signal_audio_path is not null then
      achievement := 'voice-of-the-festival'; award_amount := 5; award_title := 'Hlas festivalu!'; award_message := 'Tvoja prvá hlasová poznámka priniesla feedbacku nový rozmer.';
      insert into public.bonus_awards(event_id, person_id, achievement, amount) values (signal_event_id, investor_row.id, achievement, award_amount) on conflict do nothing;
      if found then new_awards := new_awards || jsonb_build_object('achievement', achievement, 'amount', award_amount, 'title', award_title, 'message', award_message); end if;
    end if;
  end if;

  return jsonb_build_object('signal', to_jsonb(saved_signal), 'new_awards', new_awards);
end;
$$;
revoke all on function public.save_signal(uuid, uuid, integer, text, text) from public, anon;
grant execute on function public.save_signal(uuid, uuid, integer, text, text) to authenticated;
