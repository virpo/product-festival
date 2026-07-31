-- `save_signal` declares a local `achievement` variable. The first Festival
-- Spark migration also used the unqualified `achievement` column in two
-- subqueries, which PL/pgSQL rejects as ambiguous when the RPC runs.
--
-- Keep the migration history immutable and replace the function with those
-- award columns explicitly qualified.

create or replace function public.save_signal(
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
  if event_row.status <> 'open' then raise exception 'Investovanie je uzavreté.'; end if;

  select * into investor_row from public.people where event_id = signal_event_id and auth_user_id = auth.uid();
  if investor_row.id is null then raise exception 'Najprv si vyzdvihni prístupový kód.'; end if;
  if not exists (select 1 from public.teams where id = signal_team_id and event_id = signal_event_id and archived = false) then raise exception 'Tím nie je dostupný.'; end if;
  if exists (select 1 from public.team_members where event_id = signal_event_id and team_id = signal_team_id and person_id = investor_row.id) then raise exception 'Do vlastného tímu investovať nemôžeš.'; end if;
  if signal_amount < 0 or signal_amount > event_row.max_per_team then raise exception 'Neplatná suma.'; end if;
  if length(trim(coalesce(signal_feedback_text, ''))) = 0 and signal_audio_path is null then raise exception 'Vyžaduje sa textová alebo hlasová spätná väzba.'; end if;
  if signal_audio_path is not null and not exists (
    select 1
    from storage.objects
    where bucket_id = 'festival-feedback'
      and name = signal_audio_path
      and (owner = auth.uid() or owner_id = auth.uid()::text)
  ) then
    raise exception 'Nahrávka nie je dostupná.';
  end if;

  select coalesce(sum(amount), 0)::integer into already_spent from public.signals where event_id = signal_event_id and investor_id = investor_row.id and team_id <> signal_team_id;
  select coalesce(sum(amount), 0)::integer into award_amount from public.bonus_awards where event_id = signal_event_id and person_id = investor_row.id;
  available := investor_row.wallet_budget + award_amount - already_spent;
  if signal_amount > available then raise exception 'Nemáš dosť kreditov.'; end if;

  select * into existing_signal from public.signals where event_id = signal_event_id and investor_id = investor_row.id and team_id = signal_team_id;

  insert into public.signals (event_id, investor_id, team_id, amount, feedback_text, audio_path)
  values (signal_event_id, investor_row.id, signal_team_id, signal_amount, trim(coalesce(signal_feedback_text, '')), signal_audio_path)
  on conflict (event_id, investor_id, team_id) do update set amount = excluded.amount, feedback_text = excluded.feedback_text, audio_path = excluded.audio_path
  returning * into saved_signal;
  signal_was_new := existing_signal.id is null;

  if signal_was_new then
    select array_agg(team_id) into own_team_ids from public.team_members where person_id = investor_row.id and event_id = signal_event_id;

    if not exists (select 1 from public.signals where event_id = signal_event_id and investor_id = investor_row.id and id <> saved_signal.id) then
      achievement := 'first-spark'; award_amount := 5; award_title := 'Prvá iskra!'; award_message := 'Tvoja prvá spätná väzba rozžiarila festival.';
      insert into public.bonus_awards(event_id, person_id, achievement, amount) values (signal_event_id, investor_row.id, achievement, award_amount) on conflict do nothing;
      if found then new_awards := new_awards || jsonb_build_object('achievement', achievement, 'amount', award_amount, 'title', award_title, 'message', award_message); end if;
    end if;

    if own_team_ids is not null and not exists (select 1 from public.signals s join public.team_members tm on tm.person_id = s.investor_id and tm.team_id = any(own_team_ids) where s.event_id = signal_event_id and s.id <> saved_signal.id) and not exists (select 1 from public.bonus_awards award where award.event_id = signal_event_id and award.achievement = 'team-joins-in' and award.team_id = own_team_ids[1]) then
      achievement := 'team-joins-in'; award_amount := 5; award_title := 'Tím sa pripája!'; award_message := 'Tvoj tím práve poslal svoju prvú iskru.';
      insert into public.bonus_awards(event_id, person_id, achievement, amount, team_id) values (signal_event_id, investor_row.id, achievement, award_amount, own_team_ids[1]) on conflict do nothing;
      if found then new_awards := new_awards || jsonb_build_object('achievement', achievement, 'amount', award_amount, 'title', award_title, 'message', award_message); end if;
    end if;

    if not exists (select 1 from public.signals where event_id = signal_event_id and team_id = signal_team_id and id <> saved_signal.id) and not exists (select 1 from public.bonus_awards award where award.event_id = signal_event_id and award.achievement = 'first-light' and award.team_id = signal_team_id) then
      achievement := 'first-light'; award_amount := 10; award_title := 'Prvé svetlo!'; award_message := 'Tvoja spätná väzba otvorila tímu nový pohľad.';
      insert into public.bonus_awards(event_id, person_id, achievement, amount, team_id) values (signal_event_id, investor_row.id, achievement, award_amount, signal_team_id) on conflict do nothing;
      if found then new_awards := new_awards || jsonb_build_object('achievement', achievement, 'amount', award_amount, 'title', award_title, 'message', award_message); end if;
    end if;

    if event_row.opens_at is not null
      and event_row.locks_at is not null
      and event_row.locks_at > event_row.opens_at
      and now() >= event_row.opens_at + (event_row.locks_at - event_row.opens_at) / 2 then
      select min(review_count) into minimum_reviews from (select t.id, count(s.id)::integer review_count from public.teams t left join public.signals s on s.team_id = t.id and s.event_id = signal_event_id and s.id <> saved_signal.id where t.event_id = signal_event_id and t.archived = false and not exists (select 1 from public.team_members tm where tm.team_id = t.id and tm.person_id = investor_row.id) group by t.id) counts;
      select count(*)::integer into candidate_reviews from public.signals where event_id = signal_event_id and team_id = signal_team_id and id <> saved_signal.id;
      if candidate_reviews = minimum_reviews then
        achievement := 'helpful-spotlight'; award_amount := 10; award_title := 'Pomáhaš tímu v núdzi!'; award_message := 'Tvoja spätná väzba pomáha tímu, ktorý ju teraz najviac potrebuje.';
        insert into public.bonus_awards(event_id, person_id, achievement, amount, team_id) values (signal_event_id, investor_row.id, achievement, award_amount, signal_team_id) on conflict do nothing;
        if found then new_awards := new_awards || jsonb_build_object('achievement', achievement, 'amount', award_amount, 'title', award_title, 'message', award_message); end if;
      end if;
    end if;

    select count(distinct s.team_id)::integer into explored_team_count from public.signals s where s.event_id = signal_event_id and s.investor_id = investor_row.id;
    if explored_team_count >= 3 then
      achievement := 'curious-explorer'; award_amount := 5; award_title := 'Zvedavý objaviteľ!'; award_message := 'Tri tímy už poznáš zblízka.';
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
      achievement := 'festival-sweep'; award_amount := 20; award_title := 'Festivalová výprava!'; award_message := 'Tvoja spätná väzba sa dostala ku každému tímu.';
      insert into public.bonus_awards(event_id, person_id, achievement, amount) values (signal_event_id, investor_row.id, achievement, award_amount) on conflict do nothing;
      if found then new_awards := new_awards || jsonb_build_object('achievement', achievement, 'amount', award_amount, 'title', award_title, 'message', award_message); end if;
    end if;

    if signal_audio_path is not null then
      achievement := 'voice-of-the-festival'; award_amount := 5; award_title := 'Hlas festivalu!'; award_message := 'Tvoja prvá hlasová poznámka dala spätnej väzbe nový rozmer.';
      insert into public.bonus_awards(event_id, person_id, achievement, amount) values (signal_event_id, investor_row.id, achievement, award_amount) on conflict do nothing;
      if found then new_awards := new_awards || jsonb_build_object('achievement', achievement, 'amount', award_amount, 'title', award_title, 'message', award_message); end if;
    end if;
  end if;
  if not signal_was_new and signal_audio_path is not null then
    achievement := 'voice-of-the-festival'; award_amount := 5; award_title := 'Hlas festivalu!'; award_message := 'Tvoja prvá hlasová poznámka dala spätnej väzbe nový rozmer.';
    insert into public.bonus_awards(event_id, person_id, achievement, amount) values (signal_event_id, investor_row.id, achievement, award_amount) on conflict do nothing;
    if found then new_awards := new_awards || jsonb_build_object('achievement', achievement, 'amount', award_amount, 'title', award_title, 'message', award_message); end if;
  end if;

  return jsonb_build_object('signal', to_jsonb(saved_signal), 'new_awards', new_awards);
end;
$$;

revoke all on function public.save_signal(uuid, uuid, integer, text, text) from public, anon;
grant execute on function public.save_signal(uuid, uuid, integer, text, text) to authenticated;
