# Friday smoke test

Run this after the database migration and frontend deployment, before people
enter the room.

## Setup

- [ ] Use one phone, one second browser/private window and the projector at
  1920×1080.
- [ ] Prepare two separate organizer people and codes.
- [ ] Prepare one participant with a team, one participant without that team,
  and two active teams with printed QR cards.
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
- [ ] Send written feedback with an exact amount. The portfolio, wallet and
  aggregate wall update.
- [ ] Edit the amount and feedback in the portfolio. There is still one signal
  for that team.
- [ ] Record audio feedback for another team and save it.

## Connection recovery

- [ ] Turn the phone offline. The last snapshot stays visible with a compact
  stale-data warning and **Obnoviť** action.
- [ ] Restore connectivity. The warning clears and fresh room data appears.
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
