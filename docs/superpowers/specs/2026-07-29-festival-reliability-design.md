# Product Festival Reliability Design

## Goal

Make the live Product Festival recoverable under real event conditions without
turning a cooperative feedback tool into a security-heavy voting system.

The app must survive lost browser sessions, temporary network failures,
concurrent organizer work, reconnects, and the Friday lock/release sequence
while preserving private feedback and the no-leaderboard format.

## Event Model

Product Festival supports a trusted room of participants, mentors, organizers,
and a few observers. Each person has one named wallet and portfolio. They scan
team QR codes, try products, invest fake money, and leave named text or audio
feedback.

The public wall shows only aggregate room activity. Organizers manually lock
investing and later release private team receipts.

The system optimizes for:

1. fast entry and recovery;
2. one logical identity per person;
3. current, visibly trustworthy room data;
4. atomic organizer operations;
5. database-enforced lifecycle and privacy rules.

It does not optimize for anonymous elections or adversarial financial
transactions.

## Identity And Takeover

One person may have one active Supabase identity at a time.

The first successful code claim binds the person to the current anonymous Auth
user. Entering the same code from a different browser returns a typed
`AccessCodeInUseError`. The join screen offers one explicit action:

> Tento kód sa už používa. Pokračovať na tomto zariadení?

Confirming calls the same claim RPC with `allow_takeover = true`, atomically
rebinding the person. The previous Auth user immediately loses person-scoped
RLS access. A failed write on the old device refreshes its identity and returns
it to the join screen.

Organizers use separate organizer people/codes. Sharing one `ADMIN` identity is
not the concurrency mechanism.

## Connection And Refresh State

The repository reports two independent signals:

- data changed;
- Realtime connection became connected or disconnected.

The provider remains the single owner of snapshots and refreshes. It exposes:

```ts
type ConnectionState =
  | { status: "connecting"; stale: boolean }
  | { status: "live"; stale: false }
  | { status: "retrying"; stale: true; attempt: number; message: string };
```

Failures retry after 2 seconds, 5 seconds, 30 seconds, then every 30 seconds.
Browser `online` triggers an immediate refresh. A successful complete snapshot
returns the state to `live`.

Realtime events are treated as invalidation hints. Every event causes a fresh
snapshot read; reconnecting always performs a complete read. This avoids
depending on Postgres Changes as a replayable log.

A shared `ConnectionNotice` renders a compact warning and manual retry button.
The wall uses a high-visibility corner treatment. Participant and admin pages
use a compact fixed notice. Initial failure renders a recoverable error instead
of an endless spinner.

## Atomic Organizer Operations

Supabase RPCs own operations spanning several rows:

- `save_person` writes person, access code, and team membership atomically;
- `remove_person` rejects the current organizer and the last organizer;
- `update_event_settings` changes only editable settings;
- `record_visit` validates and records a visit.

The repositories expose the same interface in demo and Supabase modes.

Access codes are normalized to uppercase and capped at 24 characters in the
form, repository, and database.

Team assignment may not change once the person has sent a signal. This avoids
retroactively creating own-team investments without adding reconciliation
logic.

## Lifecycle And RLS

Event status changes only through `advance_event`. Authenticated clients lose
direct `events` update permission. Editable event fields move through
`update_event_settings`.

`record_visit` requires:

- the event is `open`;
- the caller owns the person identity;
- the team is active and belongs to the event;
- the team is not the caller's own team.

Realtime publishes only shared room state:

- `events`;
- `event_stats`;
- `teams`;
- `people`;
- `team_members`.

It never publishes access codes, visits, signals, or audio metadata.

## Time And Audio

`datetime-local` conversion lives in one tested helper. ISO timestamps are
formatted from local date components and parsed back through the browser's
local timezone. Components never slice UTC strings.

Audio signed URLs last six hours. A fresh results load creates fresh links,
covering the complete Product Festival and networking window without a
technical expiry warning.

## UI Safety

- The current organizer cannot delete themself.
- The last organizer cannot be deleted, including through direct RPC use.
- Initial loading, stale data, and retrying are visually distinct.
- Manual lock remains manual.
- No connection or recovery UI introduces rankings or rigid coverage gates.

## Verification

Automated coverage must include:

- access-code conflict and takeover;
- old-session loss of access;
- atomic person save RPC contract;
- organizer deletion guards;
- visit lifecycle and own-team rules;
- Realtime tables and connection status;
- retry schedule and recoverable initial load;
- Bratislava timestamp roundtrip;
- six-hour audio URLs;
- 24-character access-code limit.

The final deployed smoke test uses a real phone, a second browser, and a
1920×1080 wall through the full open → lock → release flow.
