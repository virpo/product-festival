# Pancake Market Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an admin-configurable, private post-release pancake market where each team can select one affordable package and organizers can fulfill the choices.

**Architecture:** Extend the authenticated festival snapshot with an event-scoped seven-package catalogue and RLS-filtered team selections. Keep `signals.amount` as the only source of team balance; enforce catalogue writes and team choices through separate atomic Supabase RPCs, with matching demo-repository rules. Embed the team picker in `/results` and add a dedicated admin tab for live team totals, catalogue configuration, and post-release fulfillment.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5, Vitest + Testing Library, Supabase PostgreSQL/RLS/RPC, existing CSS in `src/app/globals.css`.

## Global Constraints

- Preserve `draft → open → locked → released`; do not add a lifecycle state.
- Seed exactly seven packages at 700, 600, 500, 400, 300, 200, and 100 🥞 in the approved Slovak order.
- Organizers may edit seven names, prices, and positions only before `released`; save all seven atomically.
- Require non-empty names, positions 1–7, positive whole-number prices, and strictly descending prices.
- Team balance is `sum(signal.amount)` received by the team; Festival Spark bonuses do not count.
- Any active team member may replace the team’s one shared selection only after `released`; organizers are read-only for choices.
- Keep team totals, catalogue rows, selections, selecting people, and timestamps off public and Realtime surfaces.
- Never add public ranking, winner, or balance sorting; admin team rows remain in team-number order.
- Demo mode must implement the same observable rules without environment variables.
- All participant and organizer copy is Slovak-first.

---

### Task 1: Domain Model and Market Rules

**Files:**
- Create: `src/lib/domain/pancake-market.ts`
- Create: `src/lib/domain/pancake-market.test.ts`
- Modify: `src/lib/domain/types.ts:1-147`
- Modify: `src/lib/repository/demo-data.ts:38-160`

**Interfaces:**
- Produces: `PancakePackage`, `PancakePackageDraft`, and `TeamPancakeSelection` domain types.
- Produces: required `pancakePackages: PancakePackage[]` and `pancakeSelections: TeamPancakeSelection[]` fields on `FestivalSnapshot`.
- Produces: `DEFAULT_PANCAKE_PACKAGE_DRAFTS`, `validatePancakeCatalog(drafts)`, `teamReceivedAmount(teamId, snapshot)`, and `canTeamAffordPackage(teamId, package, snapshot)`.
- Consumes: existing `FestivalSnapshot.signals` as the sole team-balance source.

- [ ] **Step 1: Write failing domain tests**

Create `src/lib/domain/pancake-market.test.ts` with focused contracts:

```ts
import { describe, expect, it } from "vitest";
import { createDemoSnapshot } from "@/lib/repository/demo-data";
import {
  DEFAULT_PANCAKE_PACKAGE_DRAFTS,
  canTeamAffordPackage,
  teamReceivedAmount,
  validatePancakeCatalog,
} from "./pancake-market";

describe("pancake market", () => {
  it("defines seven descending default tiers", () => {
    expect(DEFAULT_PANCAKE_PACKAGE_DRAFTS.map((item) => item.price)).toEqual([
      700, 600, 500, 400, 300, 200, 100,
    ]);
    expect(DEFAULT_PANCAKE_PACKAGE_DRAFTS[0].name).toBe(
      "Nugátová plnka + jahodový kompót",
    );
    expect(DEFAULT_PANCAKE_PACKAGE_DRAFTS[6].name).toBe(
      "Bryndza + kakaový prášok",
    );
  });

  it("rejects malformed and non-descending catalogues", () => {
    expect(() => validatePancakeCatalog([])).toThrow("Presne sedem");
    expect(() =>
      validatePancakeCatalog(
        DEFAULT_PANCAKE_PACKAGE_DRAFTS.map((item, index) => ({
          ...item,
          price: index === 1 ? 700 : item.price,
        })),
      ),
    ).toThrow("klesať");
  });

  it("sums received signals and accepts the exact price boundary", () => {
    const snapshot = createDemoSnapshot(new Date("2026-07-31T10:00:00Z"));
    const team = snapshot.teams[0];
    const amount = teamReceivedAmount(team.id, snapshot);
    const exact = { ...snapshot.pancakePackages[0], price: amount };
    const tooExpensive = { ...exact, price: amount + 1 };

    expect(amount).toBe(35);
    expect(canTeamAffordPackage(team.id, exact, snapshot)).toBe(true);
    expect(canTeamAffordPackage(team.id, tooExpensive, snapshot)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the domain test and confirm the missing module failure**

Run: `npm test -- src/lib/domain/pancake-market.test.ts`

Expected: FAIL because `./pancake-market` and the new snapshot fields do not exist.

- [ ] **Step 3: Add the market types to the shared domain model**

Add these exact shapes to `src/lib/domain/types.ts`:

```ts
export type PancakePackageDraft = {
  name: string;
  price: number;
  position: number;
};

export type PancakePackage = PancakePackageDraft & {
  id: string;
  eventId: string;
};

export type TeamPancakeSelection = {
  id: string;
  eventId: string;
  teamId: string;
  packageId: string;
  selectedBy: string;
  selectedAt: string;
};
```

Extend `FestivalSnapshot` with required `pancakePackages` and `pancakeSelections` arrays immediately before `stats`.

- [ ] **Step 4: Implement pure validation and accounting helpers**

Create `src/lib/domain/pancake-market.ts` with the approved names/prices and these signatures:

```ts
import type {
  FestivalSnapshot,
  PancakePackage,
  PancakePackageDraft,
} from "./types";

export const DEFAULT_PANCAKE_PACKAGE_DRAFTS = [
  { position: 1, name: "Nugátová plnka + jahodový kompót", price: 700 },
  { position: 2, name: "Čoko-oriešková plnka + banánová plnka", price: 600 },
  { position: 3, name: "Sladký tvaroh + čerešňový džem", price: 500 },
  { position: 4, name: "Maková plnka + slivkový džem", price: 400 },
  { position: 5, name: "Kávová plnka + tekutý karamel", price: 300 },
  { position: 6, name: "Gaštanový krém + mandarínkový kompót + šľahačka", price: 200 },
  { position: 7, name: "Bryndza + kakaový prášok", price: 100 },
] as const satisfies readonly PancakePackageDraft[];

export function validatePancakeCatalog(
  drafts: readonly PancakePackageDraft[],
): PancakePackageDraft[] {
  if (drafts.length !== 7) throw new Error("Presne sedem palacinkových balíčkov je povinných.");
  const normalized = drafts
    .map((item) => ({ ...item, name: item.name.trim() }))
    .sort((left, right) => left.position - right.position);
  if (normalized.some((item) => !item.name)) throw new Error("Názov balíčka nemôže byť prázdny.");
  if (normalized.some((item) => !Number.isInteger(item.price) || item.price <= 0)) {
    throw new Error("Cena musí byť kladné celé číslo.");
  }
  if (normalized.some((item, index) => item.position !== index + 1)) {
    throw new Error("Poradie musí obsahovať pozície 1 až 7.");
  }
  if (normalized.some((item, index) => index > 0 && normalized[index - 1].price <= item.price)) {
    throw new Error("Ceny musia v poradí prísne klesať.");
  }
  return normalized;
}

export function teamReceivedAmount(teamId: string, snapshot: FestivalSnapshot): number {
  return snapshot.signals
    .filter((signal) => signal.teamId === teamId)
    .reduce((total, signal) => total + signal.amount, 0);
}

export function canTeamAffordPackage(
  teamId: string,
  item: PancakePackage,
  snapshot: FestivalSnapshot,
): boolean {
  return item.eventId === snapshot.event.id && item.price <= teamReceivedAmount(teamId, snapshot);
}
```

- [ ] **Step 5: Seed the demo snapshot catalogue**

In `createDemoSnapshot`, map defaults to deterministic demo IDs and add an empty selection array:

```ts
pancakePackages: DEFAULT_PANCAKE_PACKAGE_DRAFTS.map((item) => ({
  ...item,
  id: `pancake-package-${item.position}`,
  eventId: "event-demo",
})),
pancakeSelections: [],
```

- [ ] **Step 6: Run the domain test**

Run: `npm test -- src/lib/domain/pancake-market.test.ts`

Expected: PASS for defaults, validation, total calculation, and exact affordability.

- [ ] **Step 7: Commit the domain contract**

```bash
git add src/lib/domain/types.ts src/lib/domain/pancake-market.ts src/lib/domain/pancake-market.test.ts src/lib/repository/demo-data.ts
git commit -F - <<'EOF'
feat: add pancake market domain rules

Previously team receipts had no configurable redemption model; this commit
adds the seven-tier catalogue and shared accounting primitives.

- Define package and team-selection snapshot types
- Validate descending package catalogues
- Derive affordability from received signal amounts
EOF
```

---

### Task 2: Supabase Schema, RLS, and Atomic RPCs

**Files:**
- Create: `supabase/migrations/202607310004_pancake_market.sql`
- Modify: `src/lib/repository/schema-contract.test.ts:7-214`

**Interfaces:**
- Consumes: `pancake_packages` rows shaped as `id`, `event_id`, `name`, `price`, and `position`.
- Consumes: `team_pancake_selections` rows shaped as `id`, `event_id`, `team_id`, `package_id`, `selected_by`, and `selected_at`.
- Produces RPC: `save_pancake_catalog(target_event_id uuid, target_packages jsonb) returns setof public.pancake_packages`.
- Produces RPC: `select_pancake_package(target_event_id uuid, target_package_id uuid) returns public.team_pancake_selections`.

- [ ] **Step 1: Add a failing schema-contract test**

Add a `pancakeMarketMigrationPath` and this contract to `schema-contract.test.ts`:

```ts
it("keeps the pancake market private and atomic", () => {
  const sql = readFileSync(pancakeMarketMigrationPath, "utf8").toLowerCase();
  expect(sql).toContain("create table public.pancake_packages");
  expect(sql).toContain("create table public.team_pancake_selections");
  expect(sql).toContain("alter table public.pancake_packages enable row level security");
  expect(sql).toContain("alter table public.team_pancake_selections enable row level security");
  expect(sql).toContain("create or replace function public.save_pancake_catalog");
  expect(sql).toContain("create or replace function public.select_pancake_package");
  expect(sql).toContain("status = 'released'");
  expect(sql).toContain("public.current_person_id");
  expect(sql).toContain("public.is_organizer");
  expect(sql).toContain("revoke insert, update, delete on public.pancake_packages");
  expect(sql).toContain("revoke insert, update, delete on public.team_pancake_selections");
  expect(sql).not.toContain("alter publication supabase_realtime add table public.pancake_packages");
  expect(sql).not.toContain("alter publication supabase_realtime add table public.team_pancake_selections");
});
```

- [ ] **Step 2: Run the schema test and confirm the missing migration failure**

Run: `npm test -- src/lib/repository/schema-contract.test.ts`

Expected: FAIL because `202607310004_pancake_market.sql` does not exist.

- [ ] **Step 3: Create protected catalogue and selection tables**

The migration must create:

```sql
create table public.pancake_packages (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null check (char_length(btrim(name)) > 0),
  price integer not null check (price > 0),
  position smallint not null check (position between 1 and 7),
  unique (event_id, position)
);

create table public.team_pancake_selections (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  package_id uuid not null references public.pancake_packages(id) on delete restrict,
  selected_by uuid not null references public.people(id) on delete restrict,
  selected_at timestamptz not null default now(),
  unique (event_id, team_id)
);
```

Enable RLS on both. Grant authenticated `select`, revoke direct authenticated `insert/update/delete`, and do not alter the Realtime publication.

- [ ] **Step 4: Seed defaults for existing and future events**

Insert the seven approved rows for every event that lacks a catalogue. Add an `after insert on public.events` trigger whose function inserts the same seven rows for a newly created event. Use the exact Slovak names and prices from Task 1; keep position 1–7 explicit.

- [ ] **Step 5: Add exact read policies**

Catalogue SELECT is allowed when `public.is_organizer(event_id)` or when the event is released and `public.current_person_id(event_id)` has a membership. Selection SELECT is allowed to organizers, or after release to a current member of `team_id`. No policy permits direct writes.

- [ ] **Step 6: Implement the organizer catalogue RPC**

`save_pancake_catalog` must:

1. lock the target event row `for update`;
2. require `public.is_organizer(target_event_id)`;
3. reject `released` with `pancake_catalog_frozen`;
4. require a JSON array of exactly seven objects;
5. normalize names with `btrim`, validate integer positive prices and positions 1–7;
6. reject duplicate/missing positions and any adjacent pair whose earlier price is not greater;
7. delete the pre-release event catalogue and insert all seven validated rows inside the same transaction; and
8. return rows ordered by position.

Define the function as `security definer set search_path = public`, revoke all public execution, and grant execute only to `authenticated`.

- [ ] **Step 7: Implement the team selection RPC**

`select_pancake_package` must:

1. lock the event row and require `status = 'released'`;
2. derive `caller_person_id := public.current_person_id(target_event_id)`;
3. resolve exactly one non-archived team membership for that person in the event;
4. load the package and require `package.event_id = target_event_id`;
5. calculate `received_amount := coalesce(sum(signals.amount), 0)` for the resolved team;
6. reject `package.price > received_amount` with `pancake_package_unaffordable`; and
7. upsert `(event_id, team_id)` with the package, caller, and `now()`, returning the row.

Make it `security definer set search_path = public`, revoke all public execution, and grant execute only to `authenticated`. Organizers without team membership therefore cannot select.

- [ ] **Step 8: Run the schema contract**

Run: `npm test -- src/lib/repository/schema-contract.test.ts`

Expected: PASS and explicit proof that neither private table is added to Realtime.

- [ ] **Step 9: Commit the database contract**

```bash
git add supabase/migrations/202607310004_pancake_market.sql src/lib/repository/schema-contract.test.ts
git commit -F - <<'EOF'
feat: add protected pancake market schema

Previously no durable team package choice existed; this commit adds a private
catalogue and atomic release-gated selection flow.

- Seed configurable package rows for each event
- Enforce organizer and team-member mutations in RPCs
- Keep catalogue and selections outside Realtime
EOF
```

---

### Task 3: Supabase Adapter and Provider Commands

**Files:**
- Modify: `src/lib/repository/FestivalRepository.ts:1-77`
- Modify: `src/lib/repository/supabase-repository.ts:100-383,688-717`
- Modify: `src/lib/repository/supabase-repository.test.ts`
- Modify: `src/lib/repository/repository-context.tsx:3-65,433-484`
- Modify: `src/lib/repository/repository-context.hydration.test.ts`
- Modify: `src/lib/repository/repository-context.retry.test.tsx`

**Interfaces:**
- Consumes: Task 1 domain types and Task 2 RPC/table names.
- Produces repository methods:
  - `savePancakeCatalog(packages: PancakePackageDraft[]): Promise<PancakePackage[]>`
  - `selectPancakePackage(packageId: string): Promise<TeamPancakeSelection>`
- Produces provider commands with the same arguments but `Promise<void>` return values after refresh.

- [ ] **Step 1: Add failing adapter tests**

Extend `supabase-repository.test.ts` to assert:

```ts
expect(snapshot.pancakePackages).toEqual([
  expect.objectContaining({ eventId: eventRow.id, position: 1, price: 700 }),
]);
expect(snapshot.pancakeSelections).toEqual([
  expect.objectContaining({ teamId: teamRow.id, packageId: packageRow.id }),
]);
```

Add command tests that expect these exact RPC payloads:

```ts
expect(client.rpc).toHaveBeenCalledWith("save_pancake_catalog", {
  target_event_id: eventRow.id,
  target_packages: drafts,
});
expect(client.rpc).toHaveBeenCalledWith("select_pancake_package", {
  target_event_id: eventRow.id,
  target_package_id: packageRow.id,
});
```

Update existing mocked SELECT response sequences to include catalogue and selection queries only for authenticated snapshots.

- [ ] **Step 2: Run the adapter test and confirm failures**

Run: `npm test -- src/lib/repository/supabase-repository.test.ts`

Expected: FAIL because snapshot mapping and repository methods are absent.

- [ ] **Step 3: Extend the repository interface**

Import the Task 1 types and add:

```ts
savePancakeCatalog(packages: PancakePackageDraft[]): Promise<PancakePackage[]>;
selectPancakePackage(packageId: string): Promise<TeamPancakeSelection>;
```

- [ ] **Step 4: Map catalogue and selection rows**

Add pure mappers in `supabase-repository.ts`:

```ts
function mapPancakePackage(value: unknown): PancakePackage {
  const row = value as Row;
  return {
    id: stringValue(row.id),
    eventId: stringValue(row.event_id),
    name: stringValue(row.name),
    price: numberValue(row.price),
    position: numberValue(row.position),
  };
}

function mapPancakeSelection(value: unknown): TeamPancakeSelection {
  const row = value as Row;
  return {
    id: stringValue(row.id),
    eventId: stringValue(row.event_id),
    teamId: stringValue(row.team_id),
    packageId: stringValue(row.package_id),
    selectedBy: stringValue(row.selected_by),
    selectedAt: stringValue(row.selected_at),
  };
}
```

For unauthenticated snapshots, return both new arrays empty. For authenticated snapshots, query `pancake_packages` ordered by `position` and `team_pancake_selections`; RLS decides whether the caller sees organizer-wide or own-team rows. Fail with specific Slovak load messages before assembling the snapshot.

- [ ] **Step 5: Implement the Supabase mutation methods**

Validate drafts locally with `validatePancakeCatalog`, call the Task 2 RPCs, map returned rows, and use these user-facing failures:

```ts
fail(error, "Palacinkové balíčky sa nepodarilo uložiť.");
fail(error, "Palacinkový balíček sa nepodarilo vybrať.");
```

- [ ] **Step 6: Expose refresh-after-write provider commands**

Add both methods to `FestivalContextValue["commands"]` and the memoized command object:

```ts
async savePancakeCatalog(packages) {
  await run(() => repository!.savePancakeCatalog(packages));
},
async selectPancakePackage(packageId) {
  await run(() => repository!.selectPancakePackage(packageId));
},
```

Update typed repository mocks in provider hydration/retry tests with resolved stubs so the context remains structurally complete.

- [ ] **Step 7: Run adapter and provider tests**

Run: `npm test -- src/lib/repository/supabase-repository.test.ts src/lib/repository/repository-context.hydration.test.ts src/lib/repository/repository-context.retry.test.tsx`

Expected: PASS with both mutations followed by the existing full-snapshot refresh behavior.

- [ ] **Step 8: Commit the live repository path**

```bash
git add src/lib/repository/FestivalRepository.ts src/lib/repository/supabase-repository.ts src/lib/repository/supabase-repository.test.ts src/lib/repository/repository-context.tsx src/lib/repository/repository-context.hydration.test.ts src/lib/repository/repository-context.retry.test.tsx
git commit -F - <<'EOF'
feat: expose pancake market repository commands

Previously authenticated snapshots omitted market state; this commit maps the
private catalogue and selection rows and exposes refresh-safe mutations.

- Query RLS-filtered market rows for signed-in users
- Call catalogue and package-selection RPCs
- Refresh provider state after successful writes
EOF
```

---

### Task 4: Demo Repository Parity

**Files:**
- Modify: `src/lib/repository/demo-repository.ts:1-205,644-692`
- Modify: `src/lib/repository/demo-repository.test.ts:1-205`

**Interfaces:**
- Consumes: Task 1 validation/accounting helpers and Task 3 repository signatures.
- Produces: local-storage catalogue configuration and shared team package selection with the same observable errors and lifecycle as Supabase.

- [ ] **Step 1: Add failing demo behavior tests**

Add tests that:

1. claim `ADMIN`, save a valid catalogue whose last two prices are 30 and 20, and observe seven updated rows;
2. advance `open → locked → released`, then reject another catalogue save with `Palacinková burza je už otvorená.`;
3. sign out, claim `PETER`, select package position 6 and then 7, and observe exactly one team selection with the latter package and Peter as `selectedBy`;
4. reject a package above Peter’s team total of 35;
5. sign out, claim an unassigned person, and reject selection with `Nemáš priradený tím.`; and
6. call `resetDemo()` and observe the default 700→100 catalogue plus no selections.

Use the existing `memoryStorage()` helper and assert the listener is called on catalogue and selection writes.

- [ ] **Step 2: Run demo tests and confirm interface failures**

Run: `npm test -- src/lib/repository/demo-repository.test.ts`

Expected: FAIL because `DemoFestivalRepository` does not implement the two new methods.

- [ ] **Step 3: Migrate old stored demo snapshots on read**

In `ensureSnapshot`, after parsing old storage, populate missing fields before returning:

```ts
snapshot.pancakePackages ??= DEFAULT_PANCAKE_PACKAGE_DRAFTS.map((item) => ({
  ...item,
  id: `pancake-package-${item.position}`,
  eventId: snapshot.event.id,
}));
snapshot.pancakeSelections ??= [];
```

This keeps existing browser demo data loadable after the required snapshot fields are introduced.

- [ ] **Step 4: Implement organizer catalogue configuration**

`savePancakeCatalog` must require the current stored person to be an organizer, reject `released`, normalize through `validatePancakeCatalog`, replace all seven rows with stable demo IDs, write once, broadcast once, and return a structured clone.

- [ ] **Step 5: Implement member package selection**

`selectPancakePackage` must require `released`, a current person, one membership in a non-archived team, a same-event package, and `canTeamAffordPackage`. Upsert by team ID with:

```ts
{
  id: existing?.id ?? `pancake-selection-${team.id}`,
  eventId: snapshot.event.id,
  teamId: team.id,
  packageId,
  selectedBy: person.id,
  selectedAt: new Date().toISOString(),
}
```

Write once so local listeners and `BroadcastChannel` receive the same invalidation behavior as other commands.

- [ ] **Step 6: Run demo tests**

Run: `npm test -- src/lib/repository/demo-repository.test.ts`

Expected: PASS for configuration, freeze, affordability, replacement, membership, invalidation, and reset.

- [ ] **Step 7: Commit demo parity**

```bash
git add src/lib/repository/demo-repository.ts src/lib/repository/demo-repository.test.ts
git commit -F - <<'EOF'
feat: mirror pancake market in demo mode

Previously demo storage could not exercise the market; this commit adds the
same catalogue freeze and team-choice rules used by production.

- Migrate older stored snapshots with default packages
- Validate organizer configuration and member affordability
- Persist one shared replaceable selection per team
EOF
```

---

### Task 5: Released Team Market in Results

**Files:**
- Create: `src/components/results/PancakeMarket.tsx`
- Create: `src/components/results/PancakeMarket.test.tsx`
- Modify: `src/components/results/TeamReceipt.tsx:1-109`
- Modify: `src/components/results/TeamReceipt.test.tsx:1-33`
- Modify: `src/app/results/page.tsx:1-104`
- Modify: `src/app/results/page.test.tsx`
- Modify: `src/app/globals.css` (append focused `.pancake-market-*` rules near receipt styles)

**Interfaces:**
- Consumes: `FestivalSnapshot.pancakePackages`, `pancakeSelections`, `teamReceivedAmount`, current `Team`, current `Person`, and provider command `selectPancakePackage(packageId)`.
- Produces component:

```ts
type PancakeMarketProps = {
  snapshot: FestivalSnapshot;
  team: Team;
  viewer: Person;
  onSelect?: (packageId: string) => Promise<void>;
};
```

- [ ] **Step 1: Write failing component tests**

Create `PancakeMarket.test.tsx` from `createDemoSnapshot` and set `event.status = "released"`. Add enough received signal amount for the target team to test:

- all seven configured package names render in position order;
- an exact-price package has an enabled `Vybrať` button;
- a package one credit above balance is disabled and states `Chýba 1🥞`;
- clicking an affordable package calls `onSelect(package.id)`, disables selection controls while pending, and shows success after resolve;
- a rejected promise preserves the selected card and shows `Výber sa nepodarilo uložiť.`;
- the current selection shows `Vybrané pre tím`; and
- an organizer receives no `Vybrať` buttons.

- [ ] **Step 2: Run the market component test and confirm failure**

Run: `npm test -- src/components/results/PancakeMarket.test.tsx`

Expected: FAIL because `PancakeMarket` does not exist.

- [ ] **Step 3: Implement the interactive market component**

Use local `pendingPackageId`, `message`, and `error` state. Sort a copied package array by `position`; never mutate snapshot arrays. Calculate balance once with `teamReceivedAmount`. For each card:

```tsx
const missing = Math.max(0, item.price - balance);
const selected = selection?.packageId === item.id;
const editable = viewer.role !== "organizer" && Boolean(onSelect);
```

Render the approved Virpo/Peter invitation copy, earned balance, disabled missing-amount state, selected state, and an explicit lowest-tier failure message when every package is unaffordable. In `handleSelect`, clear old notices, await `onSelect`, show `Výber pre tím je uložený.`, and on rejection show `Výber sa nepodarilo uložiť. Skús to znova.` without changing the selection prop.

- [ ] **Step 4: Embed the market after the released receipt heading**

Add an optional `onSelectPackage` prop to `TeamReceipt`. Keep the existing pre-release guard before any market rendering. After the receipt header and before `.receipt-signals`, render:

```tsx
<PancakeMarket
  onSelect={onSelectPackage}
  snapshot={snapshot}
  team={team}
  viewer={viewer}
/>
```

In `ResultsPage`, pass `commands.selectPancakePackage` only for non-organizers. Organizers keep their existing team selector and read-only market rendering.

- [ ] **Step 5: Add responsive result styling**

Add receipt-local classes for a bordered market section, earned-balance summary, one-column mobile card list, two-column wider grid, selected state, disabled state, and inline success/error copy. Reuse existing CSS variables, button treatments, `formatCredits`, and the <=640px breakpoint; do not introduce a second design system or animation dependency.

- [ ] **Step 6: Extend receipt and route regression tests**

Update `TeamReceipt.test.tsx` to prove the market is absent before release and present after release without `rank`, `miesto`, or `víťaz`. Update `results/page.test.tsx` context mocks with `selectPancakePackage`, then prove participant selection reaches the command while organizer results remain read-only.

- [ ] **Step 7: Run participant result tests**

Run: `npm test -- src/components/results/PancakeMarket.test.tsx src/components/results/TeamReceipt.test.tsx src/app/results/page.test.tsx`

Expected: PASS for release gating, affordability, pending/error behavior, replacement command wiring, and organizer read-only access.

- [ ] **Step 8: Commit the participant market**

```bash
git add src/components/results/PancakeMarket.tsx src/components/results/PancakeMarket.test.tsx src/components/results/TeamReceipt.tsx src/components/results/TeamReceipt.test.tsx src/app/results/page.tsx src/app/results/page.test.tsx src/app/globals.css
git commit -F - <<'EOF'
feat: embed pancake market in team results

Previously released receipts only showed feedback; this commit lets team
members choose one affordable configured package without leaving results.

- Show all tiers with affordability and selected states
- Persist replaceable team choices through the provider
- Keep organizer inspection read-only
EOF
```

---

### Task 6: Admin Configuration and Fulfillment

**Files:**
- Create: `src/components/admin/PancakeMarketAdmin.tsx`
- Create: `src/components/admin/PancakeMarketAdmin.test.tsx`
- Modify: `src/components/admin/AdminDashboard.tsx:3-102`
- Modify: `src/components/admin/AdminDashboard.test.tsx:1-103`
- Modify: `src/app/globals.css` (append focused `.admin-market-*` rules near admin styles)

**Interfaces:**
- Consumes: complete authenticated organizer snapshot, `teamReceivedAmount`, `validatePancakeCatalog`, and `savePancakeCatalog(packages)` provider command.
- Produces component:

```ts
type PancakeMarketAdminProps = {
  snapshot: FestivalSnapshot;
  onSave: (packages: PancakePackageDraft[]) => Promise<void>;
};
```

- [ ] **Step 1: Write failing admin-market tests**

Create `PancakeMarketAdmin.test.tsx` covering:

- open status labels amounts `Priebežné` and lists active teams in `team.number` order even when balances are inverse;
- locked status labels amounts `Konečné` and keeps the editor enabled;
- all seven name and price inputs initialize from the snapshot;
- up/down actions update positions and preserve seven rows;
- invalid descending prices show the domain validation message and do not call `onSave`;
- a valid save calls `onSave` with trimmed names and positions 1–7 and preserves input on rejection;
- released status has no inputs or save button and shows package, price, selector name/time, or `Zatiaľ nevybrané` for every active team; and
- no `rank`, `miesto`, `poradie tímov`, or `víťaz` appears.

- [ ] **Step 2: Run the admin-market test and confirm failure**

Run: `npm test -- src/components/admin/PancakeMarketAdmin.test.tsx`

Expected: FAIL because the admin market component does not exist.

- [ ] **Step 3: Implement pre-release totals and catalogue editor**

Copy snapshot packages into local editable drafts whenever the persisted package array changes. Sort active teams by `number`, derive every amount with `teamReceivedAmount`, and never sort by amount. Render provisional copy for `open`, final copy for `locked`, and neutral zero/current copy for `draft`.

Move rows by swapping adjacent array entries and then rewriting `position: index + 1`. On save, call `validatePancakeCatalog`, await `onSave`, and show `Palacinkové balíčky sú uložené.`; preserve the local drafts and show a specific inline error on failure.

- [ ] **Step 4: Implement released fulfillment rendering**

When `snapshot.event.status === "released"`, render no editable inputs. For each active team in number order, resolve its selection, package, selecting person, and timestamp. Show earned amount, package name/price, selector/time, or `Zatiaľ nevybrané`. Do not calculate ranks or comparisons.

- [ ] **Step 5: Add a dedicated Burza admin tab**

Extend `Tab` with `"market"`, add a `Store` icon tab labeled `Burza`, add `savePancakeCatalog` to `FestivalContextValueForTests["commands"]`, and render:

```tsx
<PancakeMarketAdmin
  onSave={commands.savePancakeCatalog}
  snapshot={snapshot}
/>
```

Update the `commands()` factory in `AdminDashboard.test.tsx` with a resolved `savePancakeCatalog` mock and assert that clicking the `Burza` tab shows current team amounts.

- [ ] **Step 6: Add responsive admin styling**

Use existing admin panels, fields, buttons, spacing, and breakpoints. At wide widths, show team amounts and editor as adjacent columns; at <=640px, stack them and keep reordering controls reachable. Released fulfillment rows must wrap without horizontal overflow.

- [ ] **Step 7: Run admin tests**

Run: `npm test -- src/components/admin/PancakeMarketAdmin.test.tsx src/components/admin/AdminDashboard.test.tsx`

Expected: PASS for provisional/final totals, configuration, freeze, fulfillment, and no ranking language.

- [ ] **Step 8: Commit the organizer workflow**

```bash
git add src/components/admin/PancakeMarketAdmin.tsx src/components/admin/PancakeMarketAdmin.test.tsx src/components/admin/AdminDashboard.tsx src/components/admin/AdminDashboard.test.tsx src/app/globals.css
git commit -F - <<'EOF'
feat: add pancake market admin workflow

Previously organizers could not calibrate package prices or fulfill team
choices; this commit adds private team totals and a frozen release catalogue.

- Edit seven ordered package names and prices before release
- Show live and final team totals without ranking
- Present released selections as a fulfillment list
EOF
```

---

### Task 7: Privacy Regressions and End-to-End Verification

**Files:**
- Modify: `src/components/wall/PublicWall.test.tsx`
- Modify: `src/components/results/PublicSummary.test.tsx`
- Modify only if verification exposes a real defect: files from Tasks 1–6

**Interfaces:**
- Consumes: complete pancake-market implementation.
- Produces: evidence that private market state does not leak and the production app works on mobile participant, organizer, and projector surfaces.

- [ ] **Step 1: Add explicit public-surface regression tests**

Inject a distinctive package name, team amount, and selection into a released demo snapshot. Render `PublicWall` and `PublicSummary` and assert the package name, selecting person, `Vybrané pre tím`, per-team balance, `rank`, `miesto`, and `víťaz` are absent. Keep existing aggregate totals assertions unchanged.

- [ ] **Step 2: Run public privacy tests**

Run: `npm test -- src/components/wall/PublicWall.test.tsx src/components/results/PublicSummary.test.tsx`

Expected: PASS; neither public component consumes private market arrays.

- [ ] **Step 3: Run the complete automated suite**

Run: `npm run test:run`

Expected: all Vitest suites pass with no unhandled rejection or snapshot/type fixture failure.

- [ ] **Step 4: Run lint**

Run: `npm run lint`

Expected: exit 0 with no ESLint errors.

- [ ] **Step 5: Build the production bundle**

Run: `npm run build`

Expected: Next.js production build completes and all routes compile.

- [ ] **Step 6: Smoke-test the running application**

Start `npm run dev` through the harness process manager. In a real browser:

1. Open `/`, use demo `ADMIN`, open **Burza**, verify team-number ordering and live totals, edit a name and valid descending prices, save, lock, and release.
2. Sign out, use demo `PETER`, open `/results` at a mobile viewport, verify all packages and missing-amount states, select an affordable tier configured at or below team 1’s 35🥞 total, replace it, and confirm the shared selected state survives refresh.
3. Sign back in as `ADMIN`, open **Burza**, verify Peter’s team fulfillment row shows the package, Peter, and timestamp while controls are read-only.
4. Open `/wall` at projector dimensions and verify no team balance, package name, selection, ranking, or winner appears.

Expected: the configured catalogue, shared selection, fulfillment state, privacy boundary, and responsive layouts work end to end.

- [ ] **Step 7: Commit privacy tests and any verified corrections**

```bash
git add src/components/wall/PublicWall.test.tsx src/components/results/PublicSummary.test.tsx
git commit -F - <<'EOF'
test: protect pancake market privacy

Previously public-surface tests did not know about market state; this commit
proves package choices and team balances remain private.

- Seed distinctive private market data in public component tests
- Assert wall and summary omit selections and ranking language
EOF
```
