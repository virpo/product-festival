# Participant Flow Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fragmented participant home and portfolio with one compact overview, make the scan-feedback loop obvious, promote voice feedback, add persistent useful navigation, and render AI Build Week credits as pancakes.

**Architecture:** Keep the repository, domain rules, event lifecycle, and route data flow unchanged. Add small framework-free display helpers, a reusable three-part header and mobile bottom dock, then compose the existing participant routes around them. The overview becomes the post-save destination and derives all visible investment state from the refreshed `FestivalSnapshot`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase repository adapters, Vitest, Testing Library, existing CSS design system.

## Global Constraints

- The participant loop is `Prehľad → skener → tím + feedback → Prehľad`.
- A successful save returns to the overview and shows a temporary snackbar.
- The only reassurance copy is `Môžeš neskôr zmeniť.`
- Voice recording is the primary feedback action; text remains available.
- Every person role keeps a real name, access code, role, wallet, and optional team.
- Mentors and observers use the same participant flow; organizers use the admin flow.
- Team results remain hidden until `released`.
- Currency stays configurable, but AI Build Week and demo data use `🥞`.
- Amounts render as `100🥞`, with the amount before the currency marker.
- No domain, RLS, Realtime, lifecycle, privacy, or no-leaderboard invariant changes.
- Participant screens target one 390×844 viewport at rest; sticky controls remain usable on smaller screens and with the keyboard open.

---

### Task 1: Pancake Credit Formatting

**Files:**
- Create: `src/lib/domain/credits.ts`
- Create: `src/lib/domain/credits.test.ts`
- Modify: `src/lib/domain/rules.ts`
- Modify: `src/lib/repository/demo-data.ts`
- Modify: `supabase/seed.sql`
- Modify: `supabase/demo-seed.sql`

**Interfaces:**
- Produces: `formatCredits(amount: number, currency: string): string`
- Consumes: existing `FestivalEvent.currency` values without changing their schema.

- [ ] **Step 1: Write the failing formatter tests**

```ts
import { describe, expect, it } from "vitest";
import { formatCredits } from "./credits";

describe("formatCredits", () => {
  it("places a pancake marker after the amount", () => {
    expect(formatCredits(100, "🥞")).toBe("100🥞");
  });

  it("places every configured marker after the amount", () => {
    expect(formatCredits(17, "€")).toBe("17€");
  });
});
```

- [ ] **Step 2: Run the formatter test and verify it fails**

Run: `npm test -- src/lib/domain/credits.test.ts`

Expected: FAIL because `./credits` does not exist.

- [ ] **Step 3: Implement the formatter**

```ts
export function formatCredits(amount: number, currency: string): string {
  return `${amount}${currency}`;
}
```

- [ ] **Step 4: Use suffix formatting in the domain error and seed pancakes**

In `src/lib/domain/rules.ts`, replace the per-team maximum interpolation with:

```ts
`Do jedného tímu môžeš dať najviac ${formatCredits(
  snapshot.event.maxPerTeam,
  snapshot.event.currency,
)}.`
```

Import `formatCredits` from `./credits`.

Set the demo event currency in `src/lib/repository/demo-data.ts`,
`supabase/seed.sql`, and `supabase/demo-seed.sql` to `🥞`. Do not change wallet
or maximum values.

- [ ] **Step 5: Run formatter and domain tests**

Run: `npm test -- src/lib/domain/credits.test.ts src/lib/domain/rules.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/domain/credits.ts src/lib/domain/credits.test.ts src/lib/domain/rules.ts src/lib/repository/demo-data.ts supabase/seed.sql supabase/demo-seed.sql
git commit -m "feat: format festival credits as pancakes"
```

---

### Task 2: Shared Sticky Header And Bottom Dock

**Files:**
- Create: `src/components/brand/FestivalHeader.tsx`
- Create: `src/components/brand/FestivalHeader.test.tsx`
- Create: `src/components/participant/ParticipantFrame.tsx`
- Create: `src/components/participant/ParticipantDock.tsx`
- Modify: `src/components/brand/AppShell.tsx`
- Modify: `src/components/brand/brand.test.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Produces:
  - `FestivalHeader({ left, right }: { left: ReactNode; right: ReactNode })`
  - `ParticipantFrame({ person, snapshot, mode, back, bottom, children })`
  - `ParticipantDock({ children })`
- Consumes: `formatCredits`, `remainingWallet`, `Person`, `FestivalSnapshot`.

- [ ] **Step 1: Write failing header tests**

```tsx
import { render, screen } from "@testing-library/react";
import { FestivalHeader } from "./FestivalHeader";

it("keeps useful left and right content around one centered stripe mark", () => {
  render(<FestivalHeader left={<span>Prehľad</span>} right={<span>85🥞</span>} />);
  expect(screen.getByText("Prehľad")).toBeInTheDocument();
  expect(screen.getByText("85🥞")).toBeInTheDocument();
  expect(screen.getByLabelText("Product Festival")).toBeInTheDocument();
});
```

Extend `brand.test.tsx` to prove `AppShell` accepts a custom header while its
default still shows the demo marker.

- [ ] **Step 2: Run header tests and verify they fail**

Run: `npm test -- src/components/brand/FestivalHeader.test.tsx src/components/brand/brand.test.tsx`

Expected: FAIL because `FestivalHeader` and the custom `AppShell.header` prop do
not exist.

- [ ] **Step 3: Implement the three-part header**

```tsx
import type { ReactNode } from "react";
import { Stripes } from "./Stripes";

export function FestivalHeader({
  left,
  right,
}: {
  left: ReactNode;
  right: ReactNode;
}) {
  return (
    <header className="festival-header">
      <div className="festival-header__inner">
        <div className="festival-header__left">{left}</div>
        <span aria-label="Product Festival" className="festival-header__brand">
          <Stripes size="sm" />
        </span>
        <div className="festival-header__right">{right}</div>
      </div>
    </header>
  );
}
```

Change `AppShell` to accept `header?: ReactNode` and render it in place of the
default header when supplied.

- [ ] **Step 4: Implement the participant frame and dock**

`ParticipantFrame` renders `FestivalHeader`, using the participant name and role
on the overview or a visible back link on task screens. Its right slot renders
the formatted remaining wallet while open and a localized event-state pill
otherwise.

`ParticipantDock` is:

```tsx
import type { ReactNode } from "react";

export function ParticipantDock({ children }: { children: ReactNode }) {
  return <div className="participant-dock">{children}</div>;
}
```

- [ ] **Step 5: Add structural CSS**

Use a three-column grid for geometric centering:

```css
.festival-header__inner {
  width: min(1180px, calc(100% - 32px));
  min-height: 64px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
}

.festival-header {
  position: sticky;
  top: 0;
  z-index: 40;
  background: rgba(11, 11, 13, 0.9);
  backdrop-filter: blur(16px);
  border-bottom: 1px solid var(--line);
}

.festival-header__left { justify-self: start; min-width: 0; }
.festival-header__brand { grid-column: 2; }
.festival-header__right { justify-self: end; min-width: 0; }

.participant-dock {
  position: sticky;
  bottom: 0;
  z-index: 30;
  padding: 14px 0 max(18px, env(safe-area-inset-bottom));
  background: linear-gradient(to top, var(--bg) 72%, transparent);
}
```

- [ ] **Step 6: Run header tests**

Run: `npm test -- src/components/brand/FestivalHeader.test.tsx src/components/brand/brand.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/brand src/components/participant/ParticipantFrame.tsx src/components/participant/ParticipantDock.tsx src/app/globals.css
git commit -m "feat: add persistent festival navigation"
```

---

### Task 3: Merge Home And Portfolio Into One Overview

**Files:**
- Create: `src/components/participant/ParticipantHome.test.tsx`
- Create: `src/components/participant/Snackbar.tsx`
- Create: `src/components/participant/Snackbar.test.tsx`
- Modify: `src/components/participant/ParticipantHome.tsx`
- Modify: `src/components/auth/FestivalEntry.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/portfolio/page.tsx`
- Delete: `src/components/participant/Portfolio.tsx`
- Delete: `src/components/participant/Portfolio.test.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Produces:
  - `ParticipantHome({ person, snapshot, notice, onDismissNotice, onSignOut })`
  - `Snackbar({ message, onDismiss })`
- Consumes: `formatCredits`, `coverageFor`, `remainingWallet`, existing signals,
  teams, memberships, and released state.

- [ ] **Step 1: Write failing overview tests**

```tsx
it("shows wallet, progress, investments and the next scan on one screen", () => {
  render(
    <ParticipantHome
      notice={null}
      onDismissNotice={vi.fn()}
      onSignOut={vi.fn()}
      person={person}
      snapshot={snapshot}
    />,
  );

  expect(screen.getByText("85🥞")).toBeInTheDocument();
  expect(screen.getByText("PitchPal")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Upraviť PitchPal/ })).toHaveAttribute(
    "href",
    "/t/PITCH3?from=overview",
  );
  expect(screen.getByRole("link", { name: /Skenovať ďalší tím/ })).toHaveAttribute(
    "href",
    "/scan",
  );
});

it("does not expose team results before release", () => {
  render(
    <ParticipantHome
      notice={null}
      onDismissNotice={vi.fn()}
      onSignOut={vi.fn()}
      person={person}
      snapshot={snapshot}
    />,
  );
  expect(screen.queryByRole("link", { name: /Výsledok môjho tímu/ }))
    .not.toBeInTheDocument();
});
```

Add a snackbar test proving it renders a `status` message and dismisses after
the configured timeout using fake timers.

- [ ] **Step 2: Run overview tests and verify they fail**

Run: `npm test -- src/components/participant/ParticipantHome.test.tsx src/components/participant/Snackbar.test.tsx`

Expected: FAIL because the merged overview API and snackbar do not exist.

- [ ] **Step 3: Implement the compact overview**

Render:

- remaining wallet and total wallet;
- `ProgressMeter`;
- every signal belonging to the current person as a compact row;
- formatted amount and feedback/recording marker;
- edit link `/t/${team.code}?from=overview`;
- released own-team result link only when `event.status === "released"`;
- sticky scan CTA and a quiet sign-out action.

Use `Skenovať QR kód` when no signals exist and `Skenovať ďalší tím` otherwise.

- [ ] **Step 4: Implement the post-save snackbar**

`FestivalEntry` reads `saved` and `removed` from `useSearchParams()`. It derives
the team and current signal from the refreshed snapshot and passes exactly one
notice:

```ts
const notice = savedTeam && savedSignal
  ? `Uložené pre ${savedTeam.name} · ${formatCredits(
      savedSignal.amount,
      snapshot.event.currency,
    )}`
  : removedTeam
    ? `Investícia pre ${removedTeam.name} odstránená`
    : null;
```

When the snackbar dismisses, use `router.replace("/", { scroll: false })` so a
refresh does not replay it.

- [ ] **Step 5: Keep query-param reading behind Suspense**

Wrap `FestivalEntry` in `src/app/page.tsx`:

```tsx
import { FestivalEntry } from "@/components/auth/FestivalEntry";
import { Suspense } from "react";

export default function Home() {
  return (
    <Suspense fallback={null}>
      <FestivalEntry />
    </Suspense>
  );
}
```

- [ ] **Step 6: Retire the separate portfolio**

Replace `src/app/portfolio/page.tsx` with:

```tsx
import { redirect } from "next/navigation";

export default function PortfolioPage() {
  redirect("/");
}
```

Delete the unused inline portfolio component and its old tests.

- [ ] **Step 7: Add overview CSS**

Keep summary, progress, compact ledger rows, and the sticky scan action within a
390×844 viewport for the expected 7–9 teams. Allow natural scrolling for smaller
viewports or longer content without hiding the dock.

- [ ] **Step 8: Run overview tests**

Run: `npm test -- src/components/participant/ParticipantHome.test.tsx src/components/participant/Snackbar.test.tsx`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/components/participant src/components/auth/FestivalEntry.tsx src/app/page.tsx src/app/portfolio/page.tsx src/app/globals.css
git commit -m "feat: make investments the participant overview"
```

---

### Task 4: Compact Scanner Flow

**Files:**
- Modify: `src/app/scan/page.tsx`
- Modify: `src/components/participant/QrScanner.tsx`
- Modify: `src/components/participant/QrScanner.test.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Produces: one viewport scanner with a large overview escape and manual-code
  fallback.
- Consumes: `ParticipantFrame` and the existing `parseTeamCode` behavior.

- [ ] **Step 1: Extend scanner tests**

Add assertions that the scanner renders the short heading, manual code input,
and manual submit without explanatory paragraphs:

```tsx
expect(screen.getByText("Naskenuj QR kód")).toBeInTheDocument();
expect(screen.getByLabelText("Kód tímu")).toBeInTheDocument();
expect(screen.queryByText(/QR nájdeš na stole pri produkte/))
  .not.toBeInTheDocument();
```

- [ ] **Step 2: Run the scanner test and verify the copy assertion fails**

Run: `npm test -- src/components/participant/QrScanner.test.tsx`

Expected: FAIL because the current scanner still renders the paragraph.

- [ ] **Step 3: Compose the route with participant navigation**

Use `ParticipantFrame` with:

- left/header back link `Prehľad`;
- right current balance;
- scanner content as the body.

The scanner itself renders the camera first and a compact manual-code form
below it. Its bottom dock has a large square link to `/` and the manual entry
control. Preserve current start/stop/clear error handling.

- [ ] **Step 4: Tighten scanner CSS**

Calculate the camera area from the dynamic viewport and header/dock heights.
Keep the QR targeting corners visible. Ensure camera permission errors and
manual entry fit without horizontal overflow at 320px width.

- [ ] **Step 5: Run scanner tests**

Run: `npm test -- src/components/participant/QrScanner.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/scan/page.tsx src/components/participant/QrScanner.tsx src/components/participant/QrScanner.test.tsx src/app/globals.css
git commit -m "feat: tighten the mobile scanner flow"
```

---

### Task 5: Voice-First Team Form And Return To Overview

**Files:**
- Modify: `src/app/t/[code]/page.tsx`
- Modify: `src/components/participant/SignalForm.tsx`
- Modify: `src/components/participant/SignalForm.test.tsx`
- Modify: `src/components/participant/AudioRecorder.tsx`
- Create: `src/components/participant/AudioRecorder.test.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- `SignalForm` consumes:
  - `backHref: string`
  - `backLabel: string`
  - `onSave(input, audio)`
  - optional `onDelete(): Promise<void>`
- A successful route save navigates to `/?saved=${team.code}`.
- A successful route delete navigates to `/?removed=${team.code}`.

- [ ] **Step 1: Write failing signal-form tests**

Add tests that prove:

```tsx
expect(screen.getByRole("button", { name: "Nahrať feedback" }))
  .toBeInTheDocument();
expect(screen.getByText("Alebo napíš")).toBeInTheDocument();
expect(screen.getByRole("button", { name: "Nastaviť 25🥞" }))
  .toBeInTheDocument();
expect(screen.getByText("Môžeš neskôr zmeniť.")).toBeInTheDocument();
expect(screen.getByRole("link", { name: /Späť na skener/ }))
  .toHaveAttribute("href", "/scan");
```

Extend the amount test to click `Nastaviť 25🥞`, then `Pridať kredit`, and
expect `26`.

For an existing signal, assert `Uložiť zmeny`, a confirmed destructive
`Odstrániť investíciu`, and prefilled amount/feedback.

- [ ] **Step 2: Run signal tests and verify they fail**

Run: `npm test -- src/components/participant/SignalForm.test.tsx src/components/participant/AudioRecorder.test.tsx`

Expected: FAIL on the new layout and recorder states.

- [ ] **Step 3: Reorder and simplify the form**

The DOM order is:

1. team name and optional `Otvoriť produkt`;
2. `AudioRecorder`;
3. `Alebo napíš` textarea;
4. investment amount;
5. `Môžeš neskôr zmeniť.`;
6. sticky back/save dock;
7. destructive delete only for an existing signal.

Preset buttons use `setSafeAmount(value)`, not addition, and their accessible
name is `Nastaviť ${formatCredits(value, currency)}`.

- [ ] **Step 4: Make existing audio visible and replaceable**

Extend `AudioRecorder` with:

```ts
type AudioRecorderProps = {
  existingUrl?: string | null;
  value?: Blob | null;
  onChange(value: Blob | null): void;
  onRemoveExisting?(): void;
};
```

When `existingUrl` exists and no new blob exists, show playback plus
`Nahrať znova`. Removing an existing recording calls `onRemoveExisting`.
`SignalForm` preserves `existingSignal.audioPath` until the user replaces or
removes it.

- [ ] **Step 5: Implement save/delete navigation**

In `TeamPage`, use `useRouter` and `useSearchParams`:

```ts
const editingFromOverview = searchParams.get("from") === "overview";
const backHref = editingFromOverview ? "/" : "/scan";

async function save(input: SignalInput, audio?: Blob | null) {
  await commands.upsertSignal(input, audio);
  router.push(`/?saved=${encodeURIComponent(team.code)}`);
}

async function remove() {
  await commands.removeSignal(currentPerson.id, team.id);
  router.push(`/?removed=${encodeURIComponent(team.code)}`);
}
```

Own-team and closed states use `ParticipantFrame` and a large bottom return
action instead of only the small top link.

- [ ] **Step 6: Add voice-first and dock CSS**

The red microphone control is the dominant feedback control. The textarea is
visually quieter. Amount controls remain exact and thumb-sized. At rest, the
form fits the standard mobile viewport; with the keyboard open the content
scrolls behind the sticky dock.

- [ ] **Step 7: Run signal and recorder tests**

Run: `npm test -- src/components/participant/SignalForm.test.tsx src/components/participant/AudioRecorder.test.tsx`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/app/t/'[code]'/page.tsx src/components/participant/SignalForm.tsx src/components/participant/SignalForm.test.tsx src/components/participant/AudioRecorder.tsx src/components/participant/AudioRecorder.test.tsx src/app/globals.css
git commit -m "feat: make team feedback voice first"
```

---

### Task 6: Organizer Header And Permanent Logout

**Files:**
- Create: `src/components/admin/OrganizerHeader.tsx`
- Create: `src/components/admin/OrganizerHeader.test.tsx`
- Modify: `src/app/admin/page.tsx`
- Modify: `src/app/admin/qr/page.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Produces:
  - `OrganizerHeader({ event, person, backHref?, onSignOut })`
- Consumes: `FestivalHeader`, current organizer, current event, existing
  `commands.signOut`.

- [ ] **Step 1: Write the failing organizer-header test**

```tsx
it("keeps event state and logout visible", async () => {
  const user = userEvent.setup();
  const onSignOut = vi.fn();
  render(
    <OrganizerHeader
      event={snapshot.event}
      onSignOut={onSignOut}
      person={organizer}
    />,
  );
  expect(screen.getByText("Investovanie beží")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Odhlásiť sa" }));
  expect(onSignOut).toHaveBeenCalledOnce();
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm test -- src/components/admin/OrganizerHeader.test.tsx`

Expected: FAIL because `OrganizerHeader` does not exist.

- [ ] **Step 3: Implement and mount the organizer header**

Use `FestivalHeader`:

- left: localized event state, or `Administrácia` back link on the QR route;
- center: stripes;
- right: organizer name and `Odhlásiť sa`.

Pass it through `AppShell.header` in both admin routes. Do not change dashboard
tabs or lifecycle controls.

- [ ] **Step 4: Run organizer tests**

Run: `npm test -- src/components/admin/OrganizerHeader.test.tsx src/components/admin/AdminDashboard.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/OrganizerHeader.tsx src/components/admin/OrganizerHeader.test.tsx src/app/admin/page.tsx src/app/admin/qr/page.tsx src/app/globals.css
git commit -m "feat: keep organizer controls in reach"
```

---

### Task 7: Apply Credit Formatting And New Header Across Remaining Surfaces

**Files:**
- Modify: `src/components/admin/EventOverview.tsx`
- Modify: `src/components/admin/PeopleTable.tsx`
- Modify: `src/components/participant/ParticipantHome.tsx`
- Modify: `src/components/participant/SignalForm.tsx`
- Modify: `src/components/results/PublicSummary.tsx`
- Modify: `src/components/results/TeamReceipt.tsx`
- Modify: `src/components/wall/PublicWall.tsx`
- Modify: `src/app/results/page.tsx`
- Modify: `src/app/globals.css`
- Modify relevant component tests under `src/components`

**Interfaces:**
- Consumes: `formatCredits` and `ParticipantFrame`.
- Produces: consistent `N🥞` rendering and navigation on results screens.

- [ ] **Step 1: Add failing rendering assertions**

Update wall, receipt, admin, and overview tests so pancake amounts are asserted
as `35🥞`, `100🥞`, or the corresponding fixture value. Add a test that the
results page's underlying receipt still hides feedback before release.

- [ ] **Step 2: Run the focused tests and verify failures**

Run:

```bash
npm test -- \
  src/components/wall/PublicWall.test.tsx \
  src/components/results/TeamReceipt.test.tsx \
  src/components/admin/AdminDashboard.test.tsx \
  src/components/participant/ParticipantHome.test.tsx
```

Expected: FAIL wherever prefix formatting remains.

- [ ] **Step 3: Replace every visible currency interpolation**

Run `rg -n "event\\.currency|snapshot\\.event\\.currency" src/components src/app`
and replace visible `${currency}${amount}` JSX with `formatCredits(amount,
currency)`. Keep event-setting inputs unchanged.

Use `ParticipantFrame` on results routes so the participant can always return
to the overview. Do not render own-team results before release.

- [ ] **Step 4: Run focused tests**

Run the focused command from Step 2.

Expected: PASS.

- [ ] **Step 5: Run the complete test suite and static checks**

Run:

```bash
npm test -- --run
npm run lint
npm run build
```

Expected: all tests pass; ESLint exits 0; Next production build exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/components src/app src/lib
git commit -m "refactor: unify festival credit presentation"
```

---

### Task 8: End-To-End Browser Verification And PR

**Files:**
- Modify: `README.md` only if the user-visible flow or screenshots documented
  there are stale.
- Create or update screenshots in the existing documented README asset
  location only when the README already references them.

**Interfaces:**
- Consumes: the completed local app and demo adapter.
- Produces: verified branch and GitHub pull request.

- [ ] **Step 1: Start the production build locally**

Run:

```bash
npm run build
npm run start
```

Expected: Next starts without runtime errors.

- [ ] **Step 2: Verify participant and mentor loops at 390×844**

In a real browser:

1. enter as `PETER`;
2. inspect overview without horizontal overflow;
3. open scanner and exercise manual team code;
4. submit text feedback and confirm redirect plus snackbar;
5. edit the same investment from overview;
6. record, play, replace, and remove audio;
7. delete an investment with confirmation;
8. repeat entry as `MENTOR` and confirm the same flow with mentor identity;
9. confirm own-team protection and locked/released states.

Expected: the complete loop works without a dead end; primary controls remain
reachable.

- [ ] **Step 3: Verify organizer and projector surfaces**

At desktop width:

1. enter as `ADMIN`;
2. open dashboard and QR sheet;
3. verify logout remains visible;
4. open wall at 1920×1080;
5. verify pancake totals, no team ranking, and no clipping;
6. verify summary and private receipts after release.

Expected: no regressions, overflow, leaked totals, or inaccessible logout.

- [ ] **Step 4: Capture visual evidence**

Capture:

- participant overview;
- scanner;
- new signal;
- post-save overview snackbar;
- edit signal;
- locked/released overview;
- admin dashboard;
- public wall.

Inspect each screenshot for alignment, padding, safe-area spacing, truncation,
contrast, and accidental scroll.

- [ ] **Step 5: Run final checks**

Run:

```bash
git diff --check
npm test -- --run
npm run lint
npm run build
git status --short
```

Expected: clean checks and only intentional branch changes.

- [ ] **Step 6: Commit any final verified polish**

```bash
git add README.md src
git commit -m "style: polish product festival mobile flow"
```

Skip this commit if Step 4 required no changes.

- [ ] **Step 7: Push and open the PR**

Push the neutral branch and open a PR with a concise title:

```bash
git push -u origin participant-flow-redesign
gh pr create \
  --base main \
  --head participant-flow-redesign \
  --title "feat: simplify the Product Festival participant flow" \
  --body-file /tmp/product-festival-pr.md
```

The PR body must summarize the participant loop, voice-first form, persistent
navigation, pancake credits, admin logout, automated verification, and manual
browser evidence. It must not include tool attribution.
