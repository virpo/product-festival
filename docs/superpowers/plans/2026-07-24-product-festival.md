# Product Festival 🎪 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reusable Next.js and Supabase app for QR-based product testing, named feedback, fake-money signals, private team receipts, organizer control, and a no-leaderboard public wall.

**Architecture:** The React UI consumes one `FestivalRepository` interface. `DemoFestivalRepository` persists a deterministic event to `localStorage` and syncs browser tabs; `SupabaseFestivalRepository` uses anonymous Auth, RLS-protected Postgres tables, private Storage, and Realtime aggregate updates. Domain rules remain pure functions shared by both adapters.

**Tech Stack:** Next.js 16.2, React 19.2, TypeScript, Supabase JS 2.110, html5-qrcode, qrcode.react, Lucide React, Vitest, Testing Library.

## Global Constraints

- The standalone project lives at `/Users/hraska/Code/temp/product-festival`.
- The project identity is `Product Festival 🎪`.
- Participant UI is mobile-first; organizer CRM favors density and clarity; public wall is projector-first.
- Event state is `draft → open → locked → released`.
- Default wallet is €100, default maximum per team is €50, and coverage target is a soft 75%.
- Own-team investment, overspending, and writes outside `open` are rejected.
- A saved signal needs written feedback, recorded feedback, or both.
- Public views never expose team totals, rankings, names, or raw feedback.
- Team receipts are private until `released`.
- Production persistence is Supabase; demo persistence is explicitly labelled and never presented as durable.
- The app must build and be usable without Supabase credentials.

---

### Task 1: Scaffold, Test Harness, and Brand Shell

**Files:**
- Create: `package.json`
- Create: `next.config.ts`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Create: `src/app/layout.tsx`
- Create: `src/app/globals.css`
- Create: `src/app/page.tsx`
- Create: `src/components/brand/Stripes.tsx`
- Create: `src/components/brand/AppShell.tsx`
- Create: `src/components/brand/brand.test.tsx`

**Interfaces:**
- Produces: `Stripes({ size?: "sm" | "md" })` and `AppShell({ children, mode? })`.
- All later routes inherit the global visual tokens and shell.

- [ ] **Step 1: Scaffold Next.js and install dependencies**

Run:

```bash
npx create-next-app@16.2.11 . --typescript --eslint --app --src-dir --use-npm --import-alias="@/*" --no-tailwind
npm install @supabase/supabase-js@2.110.8 html5-qrcode@2.3.8 qrcode.react@4.2.0 lucide-react zod
npm install -D vitest@4.1.10 @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

Expected: App Router project with one lockfile and no `.openai/hosting.json`.

- [ ] **Step 2: Write the failing brand test**

```tsx
import { render, screen } from "@testing-library/react";
import { AppShell } from "./AppShell";

it("renders the Product Festival identity and demo marker", () => {
  render(<AppShell mode="demo"><p>Content</p></AppShell>);
  expect(screen.getByText("Product Festival")).toBeInTheDocument();
  expect(screen.getByText("Demo dáta")).toBeInTheDocument();
});
```

- [ ] **Step 3: Run the test and verify RED**

Run:

```bash
npm test -- src/components/brand/brand.test.tsx
```

Expected: FAIL because `AppShell` does not exist.

- [ ] **Step 4: Implement the shell and visual tokens**

Create the three-stripe mark as three semantic CSS spans, not an authored SVG. Define `--bg`, `--surface`, `--ink`, `--muted`, `--cyan`, `--amber`, `--coral`, border, radius, and shadow tokens in `globals.css`. Use Space Grotesk and Instrument Sans through `next/font/google`.

- [ ] **Step 5: Verify GREEN and commit**

Run:

```bash
npm test -- src/components/brand/brand.test.tsx
npm run lint
git add .
git commit -m "feat: scaffold product festival app"
```

Expected: one passing test and zero lint errors.

---

### Task 2: Domain Model and Rules

**Files:**
- Create: `src/lib/domain/types.ts`
- Create: `src/lib/domain/rules.ts`
- Create: `src/lib/domain/stats.ts`
- Create: `src/lib/domain/qr.ts`
- Create: `src/lib/domain/rules.test.ts`
- Create: `src/lib/domain/stats.test.ts`
- Create: `src/lib/domain/qr.test.ts`

**Interfaces:**
- Produces: `FestivalSnapshot`, `Event`, `Person`, `Team`, `Visit`, `Signal`, `EventStats`.
- Produces: `validateSignal(input, snapshot)`, `remainingWallet(personId, snapshot)`, `coverageFor(personId, snapshot)`, `deriveEventStats(snapshot)`, `parseTeamCode(value)`.

- [ ] **Step 1: Write failing rule tests**

```ts
it("rejects an own-team signal", () => {
  expect(() => validateSignal({ investorId: "p1", teamId: "t1", amount: 5, feedbackText: "Useful" }, snapshot))
    .toThrow("Do vlastného tímu investovať nemôžeš.");
});

it("requires feedback text or audio", () => {
  expect(() => validateSignal({ investorId: "p2", teamId: "t1", amount: 5, feedbackText: "" }, snapshot))
    .toThrow("Pridaj feedback alebo hlasovú poznámku.");
});

it("allows feedback-only signals", () => {
  expect(validateSignal({ investorId: "p2", teamId: "t1", amount: 0, feedbackText: "I got stuck." }, snapshot).amount)
    .toBe(0);
});

it("rejects overspending and writes after lock", () => {
  expect(() => validateSignal(overBudgetSignal, snapshot)).toThrow("Nemáš dosť kreditu.");
  expect(() => validateSignal(validSignal, lockedSnapshot)).toThrow("Investovanie je zatvorené.");
});
```

- [ ] **Step 2: Run and verify RED**

Run:

```bash
npm test -- src/lib/domain
```

Expected: FAIL because the domain modules are missing.

- [ ] **Step 3: Implement minimal domain rules**

Use integer cents nowhere: the currency is deliberately fake whole units. Clamp only in controls; domain validation rejects invalid input. Keep coverage based on unique visits, not signals.

- [ ] **Step 4: Write failing aggregate and QR tests**

```ts
it("derives aggregate stats without team totals", () => {
  const stats = deriveEventStats(snapshot);
  expect(stats).toMatchObject({ signalCount: 3, totalInvested: 50, feedbackCount: 3 });
  expect(stats).not.toHaveProperty("teamTotals");
});

it.each([
  ["QUEUE7", "QUEUE7"],
  ["https://festival.test/t/QUEUE7", "QUEUE7"],
  ["https://festival.test/t/queue7?src=print", "QUEUE7"],
])("parses %s", (input, expected) => expect(parseTeamCode(input)).toBe(expected));
```

- [ ] **Step 5: Implement stats and QR parsing, verify GREEN, and commit**

Run:

```bash
npm test -- src/lib/domain
git add src/lib/domain
git commit -m "feat: add festival domain rules"
```

Expected: all domain tests pass.

---

### Task 3: Repository Contract, Demo Data, and Identity

**Files:**
- Create: `src/lib/repository/FestivalRepository.ts`
- Create: `src/lib/repository/demo-data.ts`
- Create: `src/lib/repository/demo-repository.ts`
- Create: `src/lib/repository/demo-repository.test.ts`
- Create: `src/lib/repository/repository-context.tsx`
- Create: `src/lib/repository/useFestival.ts`
- Create: `src/components/auth/JoinScreen.tsx`
- Create: `src/components/auth/JoinScreen.test.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/page.tsx`

**Interfaces:**
- `FestivalRepository` exposes `getSnapshot`, `subscribe`, `claimPerson`, `signOut`, `markVisit`, `upsertSignal`, `removeSignal`, team/person CRUD, settings update, `advanceEvent`, and `resetDemo`.
- `FestivalProvider` exposes `{ snapshot, currentPerson, loading, error, commands }`.

- [ ] **Step 1: Write failing repository tests**

```ts
it("claims a person by access code", async () => {
  const repo = new DemoFestivalRepository(memoryStorage());
  const person = await repo.claimPerson("PETER");
  expect(person.name).toBe("Peter");
});

it("syncs subscribers after a signal", async () => {
  const repo = new DemoFestivalRepository(memoryStorage());
  const listener = vi.fn();
  repo.subscribe(listener);
  await repo.upsertSignal(validSignal);
  expect(listener).toHaveBeenCalled();
});
```

- [ ] **Step 2: Verify RED**

Run:

```bash
npm test -- src/lib/repository
```

Expected: FAIL because the repository does not exist.

- [ ] **Step 3: Implement deterministic demo repository**

Seed nine teams and people across all four roles. Use readable demo codes: `PETER`, `MENTOR`, `ADMIN`, and `GUEST`. Persist under one versioned localStorage key and broadcast a `snapshot-changed` event across tabs.

- [ ] **Step 4: Write the failing join-screen test**

```tsx
it("joins with an access code and exposes demo shortcuts", async () => {
  render(<JoinScreen onJoin={onJoin} mode="demo" />);
  await user.type(screen.getByLabelText("Prístupový kód"), "PETER");
  await user.click(screen.getByRole("button", { name: "Vstúpiť" }));
  expect(onJoin).toHaveBeenCalledWith("PETER");
  expect(screen.getByRole("button", { name: /Organizátor/ })).toBeInTheDocument();
});
```

- [ ] **Step 5: Implement provider, join screen, and adaptive home route**

The root route renders the join screen when no person is claimed, participant home for ordinary roles, and a compact organizer entry for organizers.

- [ ] **Step 6: Verify GREEN and commit**

Run:

```bash
npm test -- src/lib/repository src/components/auth
git add src
git commit -m "feat: add demo data and access codes"
```

Expected: repository and identity tests pass.

---

### Task 4: Participant Scanner, Team Signal, Audio, and Portfolio

**Files:**
- Create: `src/app/scan/page.tsx`
- Create: `src/app/t/[code]/page.tsx`
- Create: `src/app/portfolio/page.tsx`
- Create: `src/components/participant/ParticipantHome.tsx`
- Create: `src/components/participant/QrScanner.tsx`
- Create: `src/components/participant/SignalForm.tsx`
- Create: `src/components/participant/SignalForm.test.tsx`
- Create: `src/components/participant/AudioRecorder.tsx`
- Create: `src/components/participant/Portfolio.tsx`
- Create: `src/components/participant/Portfolio.test.tsx`
- Create: `src/components/participant/ProgressMeter.tsx`

**Interfaces:**
- `SignalForm({ team, person, existingSignal, onSave })`.
- `AudioRecorder({ value, onChange })` returns a local `Blob` and metadata.
- `Portfolio` edits through repository commands and becomes read-only outside `open`.

- [ ] **Step 1: Write failing signal-form tests**

```tsx
it("accepts an exact amount through typing and one-euro controls", async () => {
  render(<SignalForm {...props} />);
  const input = screen.getByLabelText("Suma");
  await user.clear(input);
  await user.type(input, "37");
  await user.click(screen.getByRole("button", { name: "Pridať euro" }));
  expect(input).toHaveValue(38);
});

it("requires feedback before save", async () => {
  render(<SignalForm {...props} />);
  await user.click(screen.getByRole("button", { name: /Poslať/ }));
  expect(screen.getByRole("alert")).toHaveTextContent("Pridaj feedback");
});
```

- [ ] **Step 2: Verify RED**

Run:

```bash
npm test -- src/components/participant/SignalForm.test.tsx
```

Expected: FAIL because participant components do not exist.

- [ ] **Step 3: Implement participant home, scanner, team route, and signal form**

Load `html5-qrcode` only in the client. Stop the camera after a successful scan and on unmount. Parse the scanned value with `parseTeamCode`; fall back to manual code entry. Mark a visit when a valid team page opens.

- [ ] **Step 4: Implement MediaRecorder with resilient states**

States are `idle`, `requesting`, `recording`, `recorded`, and `error`. Support play, replace, and delete. If recording is unsupported, keep text feedback fully usable.

- [ ] **Step 5: Write failing portfolio tests**

```tsx
it("edits amount and feedback directly while open", async () => {
  render(<Portfolio snapshot={snapshot} person={person} commands={commands} />);
  await user.click(screen.getByRole("button", { name: "Upraviť QueueLess" }));
  await user.clear(screen.getByLabelText("Feedback pre QueueLess"));
  await user.type(screen.getByLabelText("Feedback pre QueueLess"), "Shorter onboarding.");
  await user.click(screen.getByRole("button", { name: "Uložiť QueueLess" }));
  expect(commands.upsertSignal).toHaveBeenCalled();
});

it("is read-only after lock", () => {
  render(<Portfolio snapshot={lockedSnapshot} person={person} commands={commands} />);
  expect(screen.queryByRole("button", { name: "Odstrániť QueueLess" })).not.toBeInTheDocument();
});
```

- [ ] **Step 6: Implement portfolio and confirmation**

Use one ledger, not a card dashboard. Lead with remaining wallet, visited progress, and a tall cyan scanner action. Keep delete explicit and confirmed.

- [ ] **Step 7: Verify GREEN and commit**

Run:

```bash
npm test -- src/components/participant src/lib/domain
git add src/app src/components src/lib
git commit -m "feat: build participant festival flow"
```

Expected: participant tests pass.

---

### Task 5: Organizer CRM and Team QR Sheets

**Files:**
- Create: `src/app/admin/page.tsx`
- Create: `src/app/admin/qr/page.tsx`
- Create: `src/components/admin/AdminDashboard.tsx`
- Create: `src/components/admin/AdminDashboard.test.tsx`
- Create: `src/components/admin/EventOverview.tsx`
- Create: `src/components/admin/TeamsTable.tsx`
- Create: `src/components/admin/PeopleTable.tsx`
- Create: `src/components/admin/EventSettings.tsx`
- Create: `src/components/admin/QrSheet.tsx`
- Create: `src/components/admin/QrSheet.test.tsx`

**Interfaces:**
- Admin tabs share repository commands.
- `QrSheet({ event, teams, origin })` renders stable URLs `${origin}/t/${team.code}`.

- [ ] **Step 1: Write failing admin tests**

```tsx
it("adds a mentor with a custom wallet", async () => {
  render(<AdminDashboard {...props} />);
  await user.click(screen.getByRole("tab", { name: "Ľudia" }));
  await user.click(screen.getByRole("button", { name: "Pridať človeka" }));
  await user.type(screen.getByLabelText("Meno"), "Valerián");
  await user.selectOptions(screen.getByLabelText("Rola"), "mentor");
  await user.clear(screen.getByLabelText("Kredit"));
  await user.type(screen.getByLabelText("Kredit"), "150");
  await user.click(screen.getByRole("button", { name: "Uložiť človeka" }));
  expect(commands.savePerson).toHaveBeenCalledWith(expect.objectContaining({ role: "mentor", walletBudget: 150 }));
});

it("separates lock and release controls", () => {
  render(<EventOverview {...props} />);
  expect(screen.getByRole("button", { name: "Uzavrieť investovanie" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Odomknúť výsledky" })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Verify RED**

Run:

```bash
npm test -- src/components/admin
```

Expected: FAIL because admin components do not exist.

- [ ] **Step 3: Implement utilitarian CRUD and lifecycle controls**

Use responsive tables on desktop and stacked rows on mobile. Show access codes only to organizers. Require confirmation for remove, lock, and release. Prevent deleting a team with signals; archive it instead.

- [ ] **Step 4: Write failing QR test**

```tsx
it("prints one QR card per active team without investor data", () => {
  render(<QrSheet event={event} teams={teams} origin="https://festival.test" />);
  expect(screen.getAllByTestId("team-qr")).toHaveLength(teams.length);
  expect(screen.getByText("https://festival.test/t/QUEUE7")).toBeInTheDocument();
  expect(screen.queryByText(/€180/)).not.toBeInTheDocument();
});
```

- [ ] **Step 5: Implement QR route, print styles, and downloads**

Render QR codes with `QRCodeSVG`. Add print CSS for A4 cards and a client-side PNG download through an offscreen canvas. Include team number, name, code, and `Naskenuj, vyskúšaj, daj feedback`.

- [ ] **Step 6: Verify GREEN and commit**

Run:

```bash
npm test -- src/components/admin
git add src
git commit -m "feat: add organizer CRM and QR sheets"
```

Expected: admin and QR tests pass.

---

### Task 6: Public Wall, Collective Summary, and Private Receipts

**Files:**
- Create: `src/app/wall/page.tsx`
- Create: `src/app/summary/page.tsx`
- Create: `src/app/results/page.tsx`
- Create: `src/components/wall/PublicWall.tsx`
- Create: `src/components/wall/PublicWall.test.tsx`
- Create: `src/components/results/PublicSummary.tsx`
- Create: `src/components/results/TeamReceipt.tsx`
- Create: `src/components/results/TeamReceipt.test.tsx`
- Create: `src/components/wall/useCountdown.ts`

**Interfaces:**
- `PublicWall` consumes only `Event` and `EventStats`.
- `TeamReceipt` requires a released event and team membership.

- [ ] **Step 1: Write the failing no-leaderboard wall test**

```tsx
it("shows aggregate room progress without team totals or names", () => {
  render(<PublicWall event={event} stats={stats} />);
  expect(screen.getByText("64")).toBeInTheDocument();
  expect(screen.getByText(/feedback/)).toBeInTheDocument();
  expect(screen.queryByText("QueueLess")).not.toBeInTheDocument();
  expect(screen.queryByText(/rebríček|poradie/i)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Verify RED**

Run:

```bash
npm test -- src/components/wall
```

Expected: FAIL because wall components do not exist.

- [ ] **Step 3: Implement projector-first wall and countdown**

Use one dominant countdown while open, one coverage bar, and three aggregate numbers. Switch copy for `draft`, `locked`, and `released`. Add a subtle cyan pulse when `stats.updatedAt` changes.

- [ ] **Step 4: Write failing receipt privacy tests**

```tsx
it("hides receipt before release", () => {
  render(<TeamReceipt event={lockedEvent} team={team} signals={signals} viewer={member} />);
  expect(screen.getByText("Výsledky ešte nie sú odomknuté.")).toBeInTheDocument();
});

it("shows named raw feedback after release without ranking", () => {
  render(<TeamReceipt event={releasedEvent} team={team} signals={signals} viewer={member} />);
  expect(screen.getByText("Peter K.")).toBeInTheDocument();
  expect(screen.getByText("€25")).toBeInTheDocument();
  expect(screen.queryByText(/miesto|rank/i)).not.toBeInTheDocument();
});
```

- [ ] **Step 5: Implement public summary and private receipt**

Public summary uses aggregate stats and role participation only. Private receipt includes names, roles, amount, raw text, and playable audio URL when available.

- [ ] **Step 6: Verify GREEN and commit**

Run:

```bash
npm test -- src/components/wall src/components/results
git add src
git commit -m "feat: add live wall and festival results"
```

Expected: wall and results tests pass.

---

### Task 7: Supabase Auth, Schema, Realtime, and Private Audio

**Files:**
- Create: `.env.example`
- Create: `supabase/config.toml`
- Create: `supabase/migrations/202607240001_product_festival.sql`
- Create: `supabase/seed.sql`
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/repository/supabase-repository.ts`
- Create: `src/lib/repository/supabase-repository.test.ts`
- Create: `src/lib/repository/create-repository.ts`
- Create: `src/lib/repository/schema-contract.test.ts`
- Modify: `src/lib/repository/repository-context.tsx`

**Interfaces:**
- `createFestivalRepository()` returns demo adapter unless both public Supabase env keys exist.
- Supabase adapter fulfills every `FestivalRepository` method.

- [ ] **Step 1: Write failing schema-contract tests**

```ts
it("defines all protected tables and aggregate realtime state", () => {
  const sql = readMigration();
  for (const table of ["events", "teams", "people", "team_members", "visits", "signals", "event_stats"]) {
    expect(sql).toContain(`create table public.${table}`);
    expect(sql).toContain(`alter table public.${table} enable row level security`);
  }
  expect(sql).toContain("alter publication supabase_realtime add table public.event_stats");
});

it("keeps raw signals private and team receipts release-gated", () => {
  const sql = readMigration();
  expect(sql).toContain("signals_select_own_or_released_team");
  expect(sql).toContain("status = 'released'");
  expect(sql).not.toContain("signals_select_public");
});
```

- [ ] **Step 2: Verify RED**

Run:

```bash
npm test -- src/lib/repository/schema-contract.test.ts
```

Expected: FAIL because the migration is missing.

- [ ] **Step 3: Implement schema, constraints, RLS, RPCs, and aggregate trigger**

Include:

- event-state enum and forward-only lifecycle RPC;
- `claim_person(access_code)` security-definer RPC bound to `auth.uid()`;
- organizer helper and current-person helper;
- unique signal and visit constraints;
- wallet and own-team checks in a `save_signal` RPC;
- aggregate `refresh_event_stats(event_id)` trigger after visits/signals/people changes;
- anonymous public reads for events, teams, and `event_stats`;
- private Storage bucket and sender/recipient policies;
- Realtime publication for `events` and `event_stats`.

- [ ] **Step 4: Write failing Supabase adapter tests around a fake client**

```ts
it("claims through anonymous auth then claim_person RPC", async () => {
  const repo = new SupabaseFestivalRepository(fakeClient);
  await repo.claimPerson("PETER");
  expect(fakeClient.auth.signInAnonymously).toHaveBeenCalled();
  expect(fakeClient.rpc).toHaveBeenCalledWith("claim_person", { claim_code: "PETER" });
});

it("subscribes only to event and aggregate stats", () => {
  const repo = new SupabaseFestivalRepository(fakeClient);
  repo.subscribe(listener);
  expect(subscribedTables()).toEqual(["events", "event_stats"]);
});
```

- [ ] **Step 5: Implement Supabase adapter and audio upload**

Use the publishable key only. Never expose a service-role key. Upload audio before `save_signal`; delete replaced audio after the signal succeeds. Create signed URLs only for authorized receipt viewers.

- [ ] **Step 6: Verify GREEN and commit**

Run:

```bash
npm test -- src/lib/repository
git add .env.example supabase src/lib
git commit -m "feat: connect Supabase realtime persistence"
```

Expected: schema and adapter tests pass.

---

### Task 8: Documentation, Accessibility, and End-to-End Verification

**Files:**
- Create: `README.md`
- Create: `LICENSE`
- Create: `AGENTS.md`
- Create: `src/app/not-found.tsx`
- Create: `src/app/error.tsx`
- Create: `public/icon.svg`
- Modify: `src/app/layout.tsx`
- Modify: route and component files found during verification

**Interfaces:**
- README is sufficient for another organizer to run demo mode, create Supabase, apply migration, seed, and deploy to Vercel or Netlify.

- [ ] **Step 1: Write README and environment contract**

Document:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_EVENT_SLUG=ai-build-week
NEXT_PUBLIC_APP_ORIGIN=http://localhost:3000
```

Document demo codes, Supabase anonymous-auth enablement, migration/seed commands, private audio bucket behavior, Vercel/Netlify deployment, and event lifecycle.

- [ ] **Step 2: Run the complete automated suite**

Run:

```bash
npm test -- --run
npm run lint
npm run build
git diff --check
```

Expected: zero failing tests, zero lint errors, successful production build, and no whitespace errors.

- [ ] **Step 3: Start the app and verify the real participant journey**

Run:

```bash
npm run dev
```

At `390×844`:

- join as `PETER`;
- open scanner and use manual code `QUEUE7`;
- open product, set €37, add feedback, save;
- see confirmation, portfolio, remaining €63, and visited progress;
- edit to €38, edit feedback, then return to scanner;
- verify microphone-denied fallback keeps the form usable.

- [ ] **Step 4: Verify organizer, wall, and results in separate tabs**

At desktop:

- join organizer with `ADMIN`;
- add one team and one mentor with €150;
- print QR sheet;
- open investing, observe wall updates after a participant signal;
- lock investing and confirm participant edits become read-only;
- release results and confirm private receipt names/raw feedback appear;
- confirm wall and public summary never show team totals.

- [ ] **Step 5: Inspect responsive layout and browser console**

Check mobile `390×844`, tablet `820×1180`, admin `1440×1000`, and wall `1920×1080`. Fix clipping, weak contrast, accidental wrapping, unreachable controls, and all console errors.

- [ ] **Step 6: Final verification and commit**

Run:

```bash
npm test -- --run
npm run lint
npm run build
git status --short
git diff --check
git add .
git commit -m "docs: finish product festival setup"
```

Expected: clean verification output and only intentional committed files. Do not deploy or push until Peter asks.
