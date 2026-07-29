# Product Festival Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Product Festival recoverable and internally consistent during
the live AI Build Week Product Festival.

**Architecture:** Keep pure rules and constants in `src/lib/domain`, persistence
and Realtime behavior behind `FestivalRepository`, snapshot/retry ownership in
`FestivalProvider`, and presentation in focused components. Supabase RPCs own
multi-row and lifecycle invariants.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest, Testing Library,
Supabase Auth/Postgres/Realtime/Storage.

**Status (2026-07-29):** Implementation and local verification are complete.
The production migration, deployment, and Friday smoke test remain deliberately
pending until Peter asks to publish.

## Global Constraints

- Preserve demo mode without environment variables.
- No public team totals, ranking, or winner.
- Never publish access codes, raw signals, visits, or audio metadata through
  Realtime.
- Manual lock and release remain separate organizer actions.
- Every behavior change follows a failing-test-first cycle.
- Do not push or deploy without Peter's explicit instruction.

---

### Task 1: Shared Access-Code And Local-Time Rules

**Files:**
- Create: `src/lib/domain/access-code.ts`
- Create: `src/lib/domain/access-code.test.ts`
- Create: `src/lib/time/local-date-time.ts`
- Create: `src/lib/time/local-date-time.test.ts`
- Modify: `src/components/auth/JoinScreen.tsx`
- Modify: `src/components/admin/PeopleTable.tsx`
- Modify: `src/components/admin/EventSettings.tsx`

**Interfaces:**
- Produces: `ACCESS_CODE_MAX_LENGTH`, `normalizeAccessCode(value)`,
  `toLocalDateTimeInput(iso)`, and `fromLocalDateTimeInput(value)`.

- [ ] Write failing tests that require uppercase/trimmed codes capped at 24
  characters and an exact ISO → local input → ISO roundtrip in
  `Europe/Bratislava`.
- [ ] Run:
  `npm test -- --run src/lib/domain/access-code.test.ts src/lib/time/local-date-time.test.ts`
  and confirm failures are caused by missing modules.
- [ ] Implement the four small helpers with no React dependencies.
- [ ] Replace duplicated access-code normalization and UTC slicing in the three
  forms with the helpers; set both access-code inputs to
  `maxLength={ACCESS_CODE_MAX_LENGTH}`.
- [ ] Re-run the focused tests and relevant component tests.

### Task 2: Recoverable Identity Takeover

**Files:**
- Modify: `src/lib/repository/FestivalRepository.ts`
- Modify: `src/lib/repository/demo-repository.ts`
- Modify: `src/lib/repository/supabase-repository.ts`
- Modify: `src/lib/repository/supabase-repository.test.ts`
- Modify: `src/lib/repository/repository-context.tsx`
- Modify: `src/components/auth/JoinScreen.tsx`
- Modify: `src/components/auth/JoinScreen.test.tsx`
- Create:
  `supabase/migrations/202607290001_festival_reliability.sql`
- Modify: `src/lib/repository/schema-contract.test.ts`

**Interfaces:**
- Produces:

```ts
type ClaimPersonOptions = { takeover?: boolean };

class AccessCodeInUseError extends Error {}

claimPerson(
  accessCode: string,
  options?: ClaimPersonOptions,
): Promise<Person>;
```

- [ ] Add failing repository tests for `allow_takeover: false`, mapping
  `access_code_in_use` to `AccessCodeInUseError`, and retrying with
  `allow_takeover: true`.
- [ ] Add failing JoinScreen tests for the explicit takeover prompt and second
  submission.
- [ ] Add failing schema-contract assertions for the three-argument
  `claim_person` RPC and atomic rebinding.
- [ ] Implement the migration and repository interface.
- [ ] Make command execution refresh identity even when a write fails, while
  preserving the original action error.
- [ ] Implement the focused takeover UI and run all identity tests.

### Task 3: Atomic Organizer And Visit Operations

**Files:**
- Modify:
  `supabase/migrations/202607290001_festival_reliability.sql`
- Modify: `src/lib/repository/schema-contract.test.ts`
- Modify: `src/lib/repository/supabase-repository.ts`
- Modify: `src/lib/repository/supabase-repository.test.ts`
- Modify: `src/lib/repository/demo-repository.ts`
- Modify: `src/lib/repository/demo-repository.test.ts`
- Modify: `src/components/admin/PeopleTable.tsx`
- Modify: `src/components/admin/AdminDashboard.tsx`
- Modify: `src/components/admin/AdminDashboard.test.tsx`

**Interfaces:**
- `save_person(target_person_id, target_event_id, target_name, target_role,
  target_wallet_budget, target_access_code, target_team_id)`
- `update_event_settings(target_event_id, target_name, target_currency,
  target_wallet_default, target_max_per_team, target_coverage_target,
  target_locks_at)`
- `record_visit(target_event_id, target_team_id)`
- hardened `remove_person(target_person_id)`

- [ ] Write failing schema-contract tests for all RPCs, organizer deletion
  guards, frozen membership after signals, event update privilege removal, and
  open/non-own active-team visit checks.
- [ ] Write failing repository tests that require one RPC call for person save,
  settings save, and visit recording.
- [ ] Write failing UI tests showing no delete action for the current
  organizer.
- [ ] Implement the SQL functions and grants as one additive migration.
- [ ] Switch the Supabase repository to the RPCs and mirror the rules in demo
  mode.
- [ ] Pass `currentPerson` into `AdminDashboard` and `PeopleTable`; hide the
  impossible delete action.
- [ ] Run repository, schema, domain, and admin tests.

### Task 4: Realtime Connection And Retry State

**Files:**
- Modify:
  `supabase/migrations/202607290001_festival_reliability.sql`
- Modify: `src/lib/repository/FestivalRepository.ts`
- Modify: `src/lib/repository/demo-repository.ts`
- Modify: `src/lib/repository/supabase-repository.ts`
- Modify: `src/lib/repository/supabase-repository.test.ts`
- Create: `src/lib/repository/retry-policy.ts`
- Create: `src/lib/repository/retry-policy.test.ts`
- Modify: `src/lib/repository/repository-context.tsx`
- Create: `src/components/connection/ConnectionNotice.tsx`
- Create: `src/components/connection/ConnectionNotice.test.tsx`
- Create: `src/components/connection/InitialLoadState.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `src/components/auth/FestivalEntry.tsx`
- Modify: client route loading branches under `src/app/`
- Modify: `src/app/globals.css`

**Interfaces:**

```ts
type RepositoryConnectionStatus = "connected" | "disconnected";

subscribe(
  listener: () => void,
  connectionListener?: (status: RepositoryConnectionStatus) => void,
): () => void;

type ConnectionState =
  | { status: "connecting"; stale: boolean }
  | { status: "live"; stale: false }
  | { status: "retrying"; stale: true; attempt: number; message: string };
```

- [ ] Write failing retry-policy tests for delays `2000`, `5000`, `30000`,
  `30000`.
- [ ] Extend repository tests to require subscriptions to `events`,
  `event_stats`, `teams`, `people`, and `team_members`, plus status mapping from
  Supabase channel callbacks.
- [ ] Write failing notice and initial-load tests for retrying, manual retry,
  wall presentation, and recoverable initial errors.
- [ ] Add the required tables to the Realtime publication.
- [ ] Implement repository connection callbacks and provider retry ownership.
- [ ] Mount one shared notice in the root layout and replace endless
  `!snapshot` spinners with `InitialLoadState`.
- [ ] Run focused tests, then the complete test suite.

### Task 5: Audio Lifetime And Contract Cleanup

**Files:**
- Modify: `src/lib/repository/supabase-repository.ts`
- Modify: `src/lib/repository/supabase-repository.test.ts`
- Modify: `README.md`
- Modify: `AGENTS.md`

**Interfaces:**
- Produces: `AUDIO_URL_TTL_SECONDS = 6 * 60 * 60`.

- [ ] Add a failing repository test asserting six-hour signed URLs.
- [ ] Implement the constant and use it for every signed recording.
- [ ] Update README operations and recovery behavior without documenting real
  production access codes.
- [ ] Add the new identity, connection, and atomic-write invariants to
  `AGENTS.md`.
- [ ] Run all tests, lint, and production build.

### Task 6: Event-Flow Verification

**Files:**
- Create: `docs/operations/friday-smoke-test.md`

**Interfaces:**
- Produces one exact operator checklist for production verification.

- [ ] Write the checklist covering separate organizers, participant takeover,
  real QR scan, text/audio feedback, wall Realtime, portfolio edits, connection
  recovery, manual lock, hidden receipts, release, private receipts, and audio
  playback.
- [ ] Run the complete local test suite, lint, and build.
- [ ] Inspect the worktree diff for architecture drift, secrets, and unrelated
  changes.
- [ ] After explicit push/deploy authorization, apply the migration before the
  frontend deployment and execute the checklist against production.
