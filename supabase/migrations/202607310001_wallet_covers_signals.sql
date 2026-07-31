-- Keep a person's wallet at or above what they have already invested.
--
-- `save_person` only rejected a negative `wallet_budget`, and the table CHECK
-- only enforces `wallet_budget >= 0`. `save_signal` validates
-- `already_spent + amount <= wallet_budget` at signal time but never
-- re-validates when the wallet is edited afterwards, so an organizer editing a
-- participant mid-event could set a wallet below that person's committed
-- signals. That breaks the no-overspending invariant, and it also makes the new
-- public progress metric incoherent: `budget_distributed` can exceed
-- `budget_total`, which the `greatest(total - distributed, 0)` clamp then hides
-- behind a "0 remaining" reading.
--
-- This is enforced with a trigger rather than another check inside
-- `save_person` so it holds for every write path, and because `save_person`
-- ships in an earlier migration that existing databases have already applied.
-- `save_person` and `save_signal` both take `for update` on the event row, so
-- the read below is serialized against concurrent signal writes.

-- Creating the trigger takes ACCESS EXCLUSIVE on public.people for the drop and
-- SHARE ROW EXCLUSIVE for the create. A blocked lock request queues ahead of
-- every later reader, so during a live event this could stall claim_person,
-- save_signal, touch_presence and every snapshot behind one slow transaction.
-- Fail fast and retry instead of head-of-line blocking the room.
set lock_timeout = '3s';

create or replace function public.enforce_wallet_covers_signals()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  committed integer;
begin
  if new.wallet_budget = old.wallet_budget then
    return new;
  end if;

  select coalesce(sum(amount), 0)::integer
  into committed
  from public.signals
  where investor_id = new.id;

  if new.wallet_budget < committed then
    raise exception 'wallet_below_committed_signals';
  end if;

  return new;
end;
$$;

drop trigger if exists people_wallet_covers_signals on public.people;

create trigger people_wallet_covers_signals
  before update of wallet_budget on public.people
  for each row
  execute function public.enforce_wallet_covers_signals();

-- The trigger only guards future updates. If the bug already fired, the row
-- keeps budget_distributed > budget_total, which both the SQL
-- `greatest(total - distributed, 0)` and deriveEventStats' `Math.max(..., 0)`
-- clamp into a permanent "100% · 0 zostáva" on the projector. Report any such
-- person at deploy time rather than freezing the inconsistency behind the
-- clamp. Raising a wallet is an organizer decision, so only notice here.
do $$
declare
  offender record;
begin
  for offender in
    select p.id, p.name, p.wallet_budget, sum(s.amount)::integer as committed
    from public.people p
    join public.signals s on s.investor_id = p.id
    group by p.id, p.name, p.wallet_budget
    having sum(s.amount) > p.wallet_budget
  loop
    raise notice
      'wallet below committed signals: person % (%) has wallet % but committed %',
      offender.name, offender.id, offender.wallet_budget, offender.committed;
  end loop;
end;
$$;

-- Restore the default so the setting cannot outlive this migration on a
-- connection that replays the whole directory.
reset lock_timeout;
