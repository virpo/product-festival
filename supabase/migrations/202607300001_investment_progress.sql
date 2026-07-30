alter table public.event_stats
  add column budget_total integer not null default 0,
  add column budget_distributed integer not null default 0,
  add column budget_remaining integer not null default 0,
  add column budget_distributed_percent integer not null default 0;

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
    budget_total,
    budget_distributed,
    budget_remaining,
    budget_distributed_percent,
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
  ),
  budget as (
    select
      coalesce(sum(p.wallet_budget), 0)::integer as total,
      coalesce((
        select sum(s.amount)
        from public.signals s
        join public.people investor on investor.id = s.investor_id
        where s.event_id = target_event_id
          and investor.role <> 'organizer'
      ), 0)::integer as distributed
    from public.people p
    where p.event_id = target_event_id
      and p.role <> 'organizer'
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
    (select total from budget),
    (select distributed from budget),
    (
      select greatest(total - distributed, 0)
      from budget
    ),
    (
      -- Floor below completion so the public wall cannot show a full bar
      -- while credits are still left. Mirrors deriveEventStats in
      -- src/lib/domain/stats.ts.
      select case
        when total = 0 then 0
        when distributed >= total then 100
        else floor(100.0 * distributed / total)::integer
      end
      from budget
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
    budget_total = excluded.budget_total,
    budget_distributed = excluded.budget_distributed,
    budget_remaining = excluded.budget_remaining,
    budget_distributed_percent = excluded.budget_distributed_percent,
    coverage_qualified_people = excluded.coverage_qualified_people,
    coverage_percent = excluded.coverage_percent,
    average_coverage = excluded.average_coverage,
    role_participation = excluded.role_participation,
    updated_at = excluded.updated_at;
end;
$$;

-- The bootstrap migration created the AI Build Week event with '$' before the
-- pancake default existed, and both seeds insert with `on conflict do nothing`,
-- so neither can change the row that production already has. Move only the
-- known bootstrap value so an organizer's own choice is never overwritten.
-- '🥞' is the single code point U+1F95E, so it passes the 1-3 character
-- validation in update_event_settings.
update public.events
set currency = '🥞'
where slug = 'ai-build-week'
  and currency = '$';

do $$
declare
  event_row record;
begin
  for event_row in select id from public.events loop
    perform public.refresh_event_stats(event_row.id);
  end loop;
end;
$$;
