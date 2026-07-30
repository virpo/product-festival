# Friday smoke test

Run this before people enter the room.

## Deploy order

The frontend degrades quietly if it runs ahead of the schema: missing
`event_stats` columns map to zero, so the wall hides its progress bar and falls
back to the legacy invested total instead of reporting an error.

- [ ] Apply `202607300001_investment_progress.sql` and
  `202607310001_wallet_covers_signals.sql` **before** deploying the frontend.
- [ ] Watch the `202607310001` output for `wallet below committed signals`
  notices. Each one names a person whose credit was already lowered below what
  they invested; fix those wallets in **Ľudia** before opening.
- [ ] Confirm the event currency reads `🥞` and not `$`. The migration only
  rewrites the bootstrap value, and only where that migration has not already
  been applied.

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
- [ ] Send written feedback with an exact amount. The overview shows the new
  investment with a confirmation, and the wallet and aggregate wall update.
- [ ] Open that investment again from the overview row, change the amount and
  save. There is still one signal for that team.
- [ ] Record audio feedback for another team and save it. While recording, the
  save and delete actions stay disabled until you stop.
- [ ] Re-record over an existing recording, then delete it. The recorder shows
  no recording and the saved signal keeps none either.
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
- [ ] Save an investment while offline. The confirmation is readable and is not
  hidden behind the stale-data warning.
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
