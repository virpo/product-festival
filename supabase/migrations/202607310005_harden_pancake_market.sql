drop function if exists public.save_pancake_catalog(uuid, jsonb);

create or replace function public.save_pancake_catalog(
  target_event_id uuid,
  target_packages jsonb,
  target_expected_packages jsonb
)
returns setof public.pancake_packages
language plpgsql
security definer
set search_path = public
as $$
declare
  event_row public.events%rowtype;
  current_packages jsonb;
  invalid_item boolean;
  position_count integer;
  has_invalid_price_order boolean;
begin
  select *
  into event_row
  from public.events
  where id = target_event_id
  for update;

  if not found then
    raise exception 'event_not_found';
  end if;

  if not public.is_organizer(target_event_id) then
    raise exception 'organizer_access_required';
  end if;

  if event_row.status = 'released' then
    raise exception 'pancake_catalog_frozen';
  end if;

  if jsonb_typeof(target_packages) <> 'array'
    or jsonb_array_length(target_packages) <> 7 then
    raise exception 'invalid_pancake_catalog';
  end if;

  select coalesce(bool_or(
    jsonb_typeof(item) <> 'object'
    or nullif(btrim(item ->> 'name'), '') is null
    or jsonb_typeof(item -> 'price') <> 'number'
    or (item ->> 'price') !~ '^[0-9]+$'
    or (item ->> 'price')::integer <= 0
    or jsonb_typeof(item -> 'position') <> 'number'
    or (item ->> 'position') !~ '^[0-9]+$'
    or (item ->> 'position')::integer not between 1 and 7
  ), false)
  into invalid_item
  from jsonb_array_elements(target_packages) item;

  if invalid_item then
    raise exception 'invalid_pancake_catalog';
  end if;

  select count(distinct (item ->> 'position')::integer)
  into position_count
  from jsonb_array_elements(target_packages) item;

  if position_count <> 7 then
    raise exception 'invalid_pancake_positions';
  end if;

  select exists (
    select 1
    from (
      select
        (item ->> 'price')::integer as price,
        lag((item ->> 'price')::integer) over (
          order by (item ->> 'position')::integer
        ) as previous_price
      from jsonb_array_elements(target_packages) item
    ) ordered_packages
    where previous_price is not null
      and previous_price <= price
  )
  into has_invalid_price_order;

  if has_invalid_price_order then
    raise exception 'pancake_prices_must_descend';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'name', package_row.name,
        'price', package_row.price,
        'position', package_row.position
      )
      order by package_row.position
    ),
    '[]'::jsonb
  )
  into current_packages
  from public.pancake_packages package_row
  where package_row.event_id = target_event_id;

  if target_expected_packages is null
    or current_packages <> target_expected_packages then
    raise exception 'pancake_catalog_stale';
  end if;

  delete from public.pancake_packages
  where event_id = target_event_id;

  insert into public.pancake_packages (event_id, name, price, position)
  select
    target_event_id,
    btrim(item ->> 'name'),
    (item ->> 'price')::integer,
    (item ->> 'position')::smallint
  from jsonb_array_elements(target_packages) item;

  update public.events
  set updated_at = now()
  where id = target_event_id;

  return query
  select package_row.*
  from public.pancake_packages package_row
  where package_row.event_id = target_event_id
  order by package_row.position;
end;
$$;

create or replace function public.select_pancake_package(
  target_event_id uuid,
  target_package_id uuid
)
returns public.team_pancake_selections
language plpgsql
security definer
set search_path = public
as $$
declare
  event_row public.events%rowtype;
  caller_person public.people%rowtype;
  caller_team public.teams%rowtype;
  package_row public.pancake_packages%rowtype;
  received_amount integer;
  saved_selection public.team_pancake_selections%rowtype;
begin
  select *
  into event_row
  from public.events
  where id = target_event_id
  for update;

  if not found then
    raise exception 'event_not_found';
  end if;

  if event_row.status <> 'released' then
    raise exception 'pancake_market_not_released';
  end if;

  select *
  into caller_person
  from public.people
  where id = public.current_person_id(target_event_id)
    and event_id = target_event_id;

  if not found then
    raise exception 'claim_access_code_first';
  end if;

  if caller_person.role = 'organizer' then
    raise exception 'organizer_cannot_select_pancake_package';
  end if;

  select team_row.*
  into caller_team
  from public.team_members membership
  join public.teams team_row
    on team_row.id = membership.team_id
   and team_row.event_id = membership.event_id
  where membership.event_id = target_event_id
    and membership.person_id = caller_person.id
    and not team_row.archived;

  if not found then
    raise exception 'team_membership_required';
  end if;

  select *
  into package_row
  from public.pancake_packages
  where id = target_package_id
    and event_id = target_event_id;

  if not found then
    raise exception 'pancake_package_not_found';
  end if;

  select coalesce(sum(signal.amount), 0)::integer
  into received_amount
  from public.signals signal
  where signal.event_id = target_event_id
    and signal.team_id = caller_team.id;

  if package_row.price > received_amount then
    raise exception 'pancake_package_unaffordable';
  end if;

  insert into public.team_pancake_selections (
    event_id,
    team_id,
    package_id,
    selected_by,
    selected_at
  ) values (
    target_event_id,
    caller_team.id,
    package_row.id,
    caller_person.id,
    now()
  )
  on conflict (event_id, team_id) do update
  set
    package_id = excluded.package_id,
    selected_by = excluded.selected_by,
    selected_at = excluded.selected_at
  returning * into saved_selection;

  update public.events
  set updated_at = now()
  where id = target_event_id;

  return saved_selection;
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

  perform 1
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

  if exists (
    select 1
    from public.team_pancake_selections
    where selected_by = target_person.id
  ) then
    raise exception 'person_with_pancake_selection_cannot_be_removed';
  end if;

  delete from public.people
  where id = target_person.id;
end;
$$;

revoke all on function public.save_pancake_catalog(uuid, jsonb, jsonb) from public;
revoke all on function public.select_pancake_package(uuid, uuid) from public;
revoke all on function public.remove_person(uuid) from public;
grant execute on function public.save_pancake_catalog(uuid, jsonb, jsonb) to authenticated;
grant execute on function public.select_pancake_package(uuid, uuid) to authenticated;
grant execute on function public.remove_person(uuid) to authenticated;
