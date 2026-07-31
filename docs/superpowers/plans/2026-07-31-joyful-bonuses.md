# Joyful Festival Bonuses Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add seven fixed, private Festival Spark bonuses with exactly-once accounting in demo and Supabase modes, while preserving public aggregate-only privacy.

**Architecture:** Keep eligibility calculation as pure domain logic over a snapshot-like input. Persist immutable `bonus_awards` rows atomically inside `save_signal`; expose only newly earned receipts from the repository write call. Compute available currency as base wallet plus awards minus signal spending everywhere, and include award sums in aggregate budget totals without exposing award detail.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest, Supabase/Postgres PL/pgSQL, Testing Library, Chromium browser smoke tests.

## Global Constraints

- No public team totals, ranking, winner, award reasons, or per-person balances.
- One editable signal per person and team; retries cannot mint awards.
- Text or audio feedback is required; amount may be zero.
- No own-team investment, overspending, or writes outside `open`.
- Results remain private until `released`.
- Realtime remains an invalidation hint and never publishes award details.
- Demo mode works without environment variables.
- Participant copy is Slovak-first and achievement discovery is private.

---

### Task 1: Add pure bonus contracts and calculator

**Files:**
- Modify: `src/lib/domain/types.ts`
- Create: `src/lib/domain/bonuses.ts`
- Create: `src/lib/domain/bonuses.test.ts`
- Modify: `src/lib/domain/rules.ts`
- Modify: `src/lib/domain/rules.test.ts`

**Interfaces:**
- `BonusAward`: `{ id: string; eventId: string; personId: string; achievement: BonusAchievement; amount: number; createdAt: string }`.
- `BonusReceipt`: `{ achievement: BonusAchievement; amount: number; title: string; message: string }`.
- `BonusAchievement`: seven stable string identifiers: `first-spark`, `team-joins-in`, `first-light`, `helpful-spotlight`, `curious-explorer`, `festival-sweep`, `voice-of-the-festival`.
- `calculateBonusAwards(input): BonusReceipt[]` accepts event, reviewer, teams, team members, existing signals, existing awards, candidate signal, and current time; it returns only newly earned awards and never mutates input.
- `availableWallet(personId, snapshot, awards): number` returns base wallet plus award amounts minus signal amounts.

- [ ] **Step 1: Write failing tests** for all seven triggers, Slovak receipts, stacking, first-review zero amount/audio, midpoint boundaries, invalid schedules, tied zero-review teams, once-per-team helpful spotlight, three-team explorer, complete foreign-team sweep, and already-awarded idempotency.
- [ ] **Step 2: Run `npm exec vitest run src/lib/domain/bonuses.test.ts src/lib/domain/rules.test.ts`** and verify failures are limited to missing bonus contracts/calculation.
- [ ] **Step 3: Implement stable types, fixed amounts, pure trigger evaluation, and the shared available-wallet formula.** Use event timestamps for midpoint and exclude archived/own teams.
- [ ] **Step 4: Run the same targeted tests and verify they pass.**
- [ ] **Step 5: Commit `feat: define festival spark bonus rules`.**

### Task 2: Extend repository contracts and demo persistence

**Files:**
- Modify: `src/lib/repository/FestivalRepository.ts`
- Modify: `src/lib/repository/demo-repository.ts`
- Modify: `src/lib/repository/demo-data.ts`
- Modify: `src/lib/repository/repository-context.tsx`
- Modify: `src/lib/repository/demo-repository.test.ts`
- Modify: `src/lib/repository/repository-context.hydration.test.tsx`

**Interfaces:**
- `upsertSignal` returns `SignalSaveResult`: `{ signal: Signal; awards: BonusReceipt[] }`.
- `FestivalSnapshot` keeps public shape unchanged; demo awards stay in private persisted state and are only returned by the write call.

- [ ] **Step 1: Add failing demo tests** proving first review adds +5 available currency, overlapping awards stack, edits do not re-award, deletion does not claw back, and a retry returns an empty awards array.
- [ ] **Step 2: Run `npm exec vitest run src/lib/repository/demo-repository.test.ts src/lib/repository/repository-context.hydration.test.tsx`** and verify the new expectations fail.
- [ ] **Step 3: Persist private demo awards, calculate candidates before applying a new signal, update local wallet/stat derivation with award sums, and return private receipts.** Keep snapshot serialization backward-compatible for existing demo data with no awards array.
- [ ] **Step 4: Update all repository-context types/callers to consume `SignalSaveResult` without exposing awards through snapshot or subscriptions.**
- [ ] **Step 5: Run the full repository targeted tests and verify pass.**
- [ ] **Step 6: Commit `feat: persist demo festival spark awards`.**

### Task 3: Add atomic Supabase award ledger and RPC behavior

**Files:**
- Create: `supabase/migrations/202607310001_festival_sparks.sql`
- Modify: `src/lib/repository/supabase-repository.ts`
- Modify: `src/lib/repository/supabase-repository.test.ts`
- Modify: `src/lib/repository/schema-contract.test.ts`
- Modify: `supabase/migrations/202607300001_investment_progress.sql`

**Interfaces:**
- Private table `public.bonus_awards` has event/person/achievement/amount/created_at, a uniqueness constraint for `(event_id, person_id, achievement)` and an additional uniqueness constraint for `(event_id, person_id, achievement, team_id)` only for `helpful-spotlight` awards.
- `save_signal` returns a JSON object containing the saved signal row and `new_awards`; the adapter maps this to `SignalSaveResult`.
- RLS permits the authenticated current person to read only their own awards; no public or Realtime publication includes the table.

- [ ] **Step 1: Add schema-contract and adapter tests** for migration presence, RPC argument/return mapping, empty receipts on retry, and private award query policy.
- [ ] **Step 2: Run the full Supabase repository/schema test files** and verify expected failures.
- [ ] **Step 3: Write the migration** creating the ledger, private RLS, helper calculation, and a `save_signal` replacement that locks the event, validates existing invariants, checks base wallet + awards - spend, upserts the signal, inserts newly qualifying awards with conflict protection, and returns the signal plus private receipts in one transaction.
- [ ] **Step 4: Update aggregate stats SQL** so budget total and remaining include award sums while preserving aggregate-only fields.
- [ ] **Step 5: Update the adapter to map the new RPC response and retain orphan-audio cleanup behavior.**
- [ ] **Step 6: Run the targeted Supabase tests and inspect migration SQL for no award Realtime publication or public read policy.**
- [ ] **Step 7: Commit `feat: award festival sparks atomically in supabase`.**

### Task 4: Add private participant celebration

**Files:**
- Modify: `src/app/t/[code]/page.tsx`
- Modify: `src/components/participant/ParticipantHome.tsx`
- Create: `src/components/participant/BonusReveal.tsx`
- Create: `src/components/participant/BonusReveal.test.tsx`
- Modify: `src/components/participant/ParticipantFrame.test.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- `BonusReveal` accepts `awards: BonusReceipt[]`, `currency: string`, `onContinue(): void`, and `reducedMotion?: boolean`.
- The page consumes awards returned from `upsertSignal` and displays them only in the current participant flow; navigation/refresh does not reconstruct or replay receipts.

- [ ] **Step 1: Write failing component tests** for one award, stacked awards, Slovak copy, accessible live-region announcement, continue action, and reduced-motion behavior.
- [ ] **Step 2: Run the component test file and verify failures.**
- [ ] **Step 3: Implement a compact private reveal based on the selected Hero Spark direction, with no public totals or catalogue, and a static fallback for reduced motion.**
- [ ] **Step 4: Thread `SignalSaveResult.awards` from the save handler into the reveal without changing the existing successful navigation contract for no-award saves.**
- [ ] **Step 5: Run participant component tests and verify pass.**
- [ ] **Step 6: Commit `feat: celebrate private festival spark awards`.**

### Task 5: Full verification and browser smoke test

**Files:**
- Modify only if verification reveals a real defect; do not weaken tests or privacy rules.

- [ ] **Step 1: Run `npm run test:run` and confirm the complete suite passes.**
- [ ] **Step 2: Run `npm run lint` and `npm run build`; fix only source defects.**
- [ ] **Step 3: Start the app in demo mode and use Chromium at a mobile viewport to submit first, overlapping, edit, no-award, and midpoint-help flows.**
- [ ] **Step 4: Confirm the projector wall remains aggregate-only and does not show award reasons, person balances, signals, or audio metadata.**
- [ ] **Step 5: If local Supabase is available, apply the migration and exercise concurrent/idempotent saves; otherwise record that boundary as unverified without claiming success.**
- [ ] **Step 6: Run `git diff --check` and inspect all exported-symbol call sites for return-shape consistency.**
- [ ] **Step 7: Commit any final defect fixes with Conventional Commits and report exact verification output.**
