# Festival Sparks Design

## Goal

Reward meaningful feedback moments with small, private currency bonuses that make the festival feel generous without creating public rankings or a second game system.

## Approved catalogue

All amounts are fixed festival currency and stack when one review unlocks multiple achievements.

| Achievement | Trigger | Amount |
| --- | --- | ---: |
| First Spark | Reviewer’s first valid foreign-team review, including zero-currency or audio-only feedback | 5 |
| Team Joins In | First valid foreign-team review submitted by anyone on the reviewer’s team | 5 |
| First Light | First valid review received by the reviewed team | 10 |
| Helpful Spotlight | After midpoint, review a currently least-reviewed team; once per eligible team | 10 |
| Curious Explorer | Reviewer submits reviews for three different foreign teams | 5 |
| Festival Sweep | Reviewer reviews every current, non-archived foreign team | 20 |
| Voice of the Festival | Reviewer’s first audio review | 5 |

## Eligibility and invariants

- Any person who can submit a valid foreign-team review can earn bonuses; observers and organizers remain subject to existing write rules.
- Text or audio feedback qualifies. Amount zero qualifies.
- Own-team reviews remain forbidden.
- Midpoint requires valid `opensAt` and `locksAt`, with `locksAt` after `opensAt`; otherwise Helpful Spotlight is inactive.
- Every achievement is once per event/person except Helpful Spotlight, which is once per event/person/reviewed-team.
- Ties at the lowest review count all qualify, including zero-review teams.
- Edits and deletes never claw back an awarded bonus. Retries and concurrent submissions cannot duplicate an award.
- Awards are private to the triggering reviewer. No award reasons, award ledger rows, access codes, visits, signals, or audio metadata enter public or Realtime payloads.
- The catalogue and amounts are fixed in code; there is no campaign configuration UI.
- Participant copy is Slovak-first and reveals achievements as discovered rather than showing a full catalogue.

## Accounting contract

Awards are immutable rows in a private `bonus_awards` ledger. They do not mutate `people.wallet_budget`, which remains the configured base wallet.

For a person in an event:

```text
spent = sum(signal.amount)
available = person.wallet_budget + sum(bonus_awards.amount) - spent
```

The `save_signal` transaction locks the event, validates all existing signal rules, computes available currency using the same formula, writes or updates the signal, computes newly earned awards, inserts them under uniqueness constraints, and returns the saved signal plus the newly created private award receipts. A retry returns no new receipts.

The demo repository mirrors the same observable formula and exactly-once behavior in its local snapshot.

Aggregate `budgetTotal` and `budgetRemaining` include earned bonus currency so the projector’s totals remain internally consistent with spendable currency. They expose only aggregate sums; they do not expose award counts, reasons, people, or team attribution. Team-level public totals and rankings remain prohibited.

## UX

After a successful save, the participant sees a short private Festival Spark reveal. Stacked awards appear as one bundle with each reason listed. When the reward appears, one brief burst of cyan, amber, and coral particles crosses the viewport and then disappears; it never loops or blocks interaction. The reveal is delayed only for presentation; the server decides amounts and eligibility. Reduced-motion users receive the same content without the burst or entrance animation. Refreshing or returning to the wall does not replay or expose the receipt.

## Architecture

- Add small domain types and a pure award calculator beside existing signal rules.
- Extend the repository return contract with private award receipts.
- Add one Supabase migration containing the ledger, private RLS, and an atomic `save_signal` replacement.
- Keep demo mode functional without environment variables.
- Keep public snapshot and Realtime shapes free of award details; aggregate stats derive from base wallets plus award sums.

## Verification

Targeted domain and repository tests cover each trigger, exact midpoint, ties, zero-review teams, overlapping awards, edits, retries, concurrency/idempotency, closed events, own-team rejection, and the accounting formula. Full tests, lint, production build, and real-browser mobile participant/projector smoke checks are required before completion.
