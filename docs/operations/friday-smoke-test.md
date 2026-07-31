# Friday smoke test

Run this before people enter the room.

## Deploy order

The frontend degrades quietly if it runs ahead of the schema: missing
`event_stats` columns map to zero, so the wall hides its progress bar and falls
back to the legacy invested total instead of reporting an error.

- [ ] Apply `202607300001_investment_progress.sql` and
  `202607310001_wallet_covers_signals.sql` with `npx supabase db push` **before**
  deploying the frontend.
- [ ] `202607310001` sets a 3s `lock_timeout` on purpose, so that creating its
  trigger fails fast instead of queueing ahead of every reader of
  `public.people`. Under load it can abort with
  `canceling statement due to lock timeout`. That is safe: the file is
  idempotent (`create or replace`, `drop trigger if exists`), so re-run it in a
  quieter moment. If you pasted it into the SQL editor rather than pushing it,
  run `reset lock_timeout;` in that session afterwards.
- [ ] Check that nobody already holds less credit than they have invested. The
  migration raises a `wallet below committed signals` notice per offender, but
  that output is easy to miss, so run this in the Supabase SQL editor and
  require zero rows:

  ```sql
  select p.id, p.name, p.wallet_budget, sum(s.amount) as committed
  from public.people p
  join public.signals s on s.investor_id = p.id
  group by p.id, p.name, p.wallet_budget
  having sum(s.amount) > p.wallet_budget;
  ```

  Any row names a person whose credit was lowered below what they invested.
  Raise that wallet in **Ľudia** before opening.
- [ ] Confirm the event currency reads `🥞` and not `$`. The migration only
  rewrites the bootstrap value, and only where that migration has not already
  been applied.

## Setup

- [ ] Use one phone, one second browser/private window and the projector at
  1920×1080.
- [ ] Prepare two separate organizer people and codes.
- [ ] Prepare one participant with a team, one participant without that team,
  and three active teams with printed QR cards. Three, so the participant still
  has a second foreign team after the first one is used for written feedback.
- [ ] Keep the event in `draft`.

## Identity and administration

- [ ] Sign in both organizers with their own codes. Both can open `/admin`.
- [ ] The current organizer has no delete action in **Ľudia**.
- [ ] Add or edit one test person with a code and team. Reload: all three values
  either changed together or did not change.
- [ ] Sign in a participant on the phone. Enter the same code in the private
  window: takeover requires explicit confirmation.
- [ ] Confirm takeover. Refresh or perform an action on the old browser: it
  returns to the entry screen.

## Open festival

- [ ] Manually advance `draft → open`.
- [ ] Scan a real printed team QR code on the phone over HTTPS.
- [ ] Scan the participant’s own team. It does not record a visit or offer an
  investment.
- [ ] Scan a foreign team. The product screen opens and the wall visit count
  updates without a manual reload.
- [ ] Send written feedback with an exact amount. The overview shows the new
  investment with a confirmation, and the wallet and aggregate wall update.
- [ ] Open that investment again from the overview row, change the amount and
  save. There is still one signal for that team.
- [ ] Record audio feedback for a second foreign team, add a short written note
  as well, and save. The note matters: a signal needs text or audio, so the
  delete-and-save step below would be rejected on an audio-only signal.
- [ ] Reopen that signal and start recording again. **Uložiť zmeny** is disabled
  with a "Najprv zastav nahrávanie" hint while recording; the delete action
  stays available. Stop, and the save re-enables.
- [ ] Re-record over the existing recording, delete it, then **save**. Reopen
  the signal: the written note is still there and no recording is attached.
  Removal only reaches the database on save, so skipping the save here would
  leave the original audio in place.
- [ ] Record and save once more on that signal, so a recording remains for the
  released-receipt playback check below.
- [ ] The wall's progress bar rises as credits are distributed and only reads
  100% once nothing is left. The invested figure agrees with the bar.
- [ ] In **Ľudia**, try lowering a participant's credit below what they have
  already invested. It is rejected with a readable message.

## Connection recovery

- [ ] Turn the phone offline. The last snapshot stays visible with a compact
  stale-data warning and **Obnoviť** action.
- [ ] Restore connectivity. The warning clears and fresh room data appears.
- [ ] Repeat while editing an investment on `/t/<code>` at 390×844. The warning
  sits above the dock and does not cover **Uložiť zmeny** or the delete action.
- [ ] Save an investment while fully offline. It must **fail** on the form with
  an inline error and no confirmation — a write that never reached the server
  must never look saved.
- [ ] The overlapping confirmation-plus-warning case needs the opposite state:
  the write commits and only the follow-up refresh fails. Stage it by tapping
  save and dropping connectivity immediately afterwards. If both appear, they
  must be readable and not cover each other. Skip rather than fake this one; it
  is timing-dependent.
- [ ] Repeat on `/wall`: the warning is clearly visible from the room, but does
  not cover the main numbers.

## Lock and release

- [ ] Manually advance `open → locked`. Participant save, edit, delete and new
  visit writes are blocked.
- [ ] Team receipts are still hidden.
- [ ] Manually advance `locked → released`.
- [ ] The public wall and `/summary` show aggregate closing numbers only—no team
  totals or ranking.
- [ ] A team member sees only their team’s named feedback and amounts.
- [ ] An organizer can inspect every team receipt.
- [ ] Play the recorded audio from the released receipt.

## Done

- [ ] Test data is clearly identified or removed without touching event data.
- [ ] Projector remains on the intended wall/summary route.
- [ ] Organizer devices remain signed in with separate identities.
