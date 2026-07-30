# Product Festival Participant Flow Redesign

## Goal

Make the live festival loop obvious on a phone:

`Prehľad → skener → tím + feedback → Prehľad`

The interface should explain navigation and state. Organizers will explain the
festival mechanics in person, so the app does not need instructional speeches.
This is a UI and navigation change; the existing event rules, persistence,
privacy, lifecycle, and Realtime behavior stay intact.

## Chosen Approach

Use one participant overview as both home and investment portfolio.

After a successful save, return directly to the overview and show a temporary
snackbar:

> Uložené pre Ledger Lens · 17🥞

There is no confirmation screen. The saved investment is already visible in the
overview, and the strongest next action is `Skenovať ďalší tím`.

The old `/portfolio` URL remains a compatible alias or redirect to the overview.

## Participant Shell

Every authenticated participant screen uses the same sticky three-part header:

- left: identity on the overview, otherwise the useful back destination;
- center: the three AI Build Week stripes, geometrically centered;
- right: remaining balance while open, or the event state after lock.

Task screens also use a safe-area-aware sticky bottom dock. A small top back link
is never the only way out.

The overview, scanner, and team form should fit in one standard mobile viewport
at rest where the amount of content allows it. Small devices, an open keyboard,
long feedback, or unusually many teams may scroll naturally. The primary bottom
action stays reachable.

## Overview

The overview replaces the separate home and portfolio experiences. It contains:

- remaining balance;
- visited-team progress;
- a compact list of existing investments;
- a direct `Upraviť` action for each investment;
- the released result of the participant's own team, only after release;
- a prominent sticky `Skenovať QR kód` or `Skenovať ďalší tím` action.

The investment list is compact enough to show the expected festival-sized set
without decorative cards or repeated explanations. Empty, open, locked, and
released states change labels and available actions without introducing new
screens.

## Scanner

The scanner keeps the camera as the main content. The header returns to the
overview and shows the remaining balance. The bottom dock provides a large back
control and the manual-code fallback.

Camera startup, permission failure, and manual entry retain their existing
behavior.

## Team And Feedback

The team screen contains one compact form:

1. team identity and optional product link;
2. voice recording as the primary feedback action;
3. text feedback as the secondary option;
4. exact investment amount with `−`, numeric input, `+`, and unambiguous preset
   amounts;
5. one short reassurance: `Môžeš neskôr zmeniť.`;
6. a sticky bottom dock with back and save.

When editing an existing investment, the same screen is prefilled and uses
`Uložiť zmeny`. Deletion stays separate, visually destructive, and confirmed.
There is no separate edit screen type.

A successful save waits for the existing repository command and refreshed
snapshot, then navigates to the overview and opens the snackbar. Failures remain
on the form with the existing concrete error.

## Organizer Shell

The organizer dashboard gets a sticky header with:

- live event state on the left;
- centered stripes;
- organizer identity and an always-visible `Odhlásiť sa` action on the right.

Existing dashboard tabs, CRUD behavior, lifecycle controls, and public-wall
links remain unchanged.

## Pancake Credits

Currency remains configurable so the open-source app stays reusable. AI Build
Week uses `🥞`.

A shared formatter renders the amount before the currency marker, for example
`100🥞`, everywhere:

- participant overview and forms;
- validation messages;
- organizer dashboard and people table;
- public wall and summary;
- private team receipts.

Demo and event seed data use `🥞`. No wallet, maximum, or investment rule
changes.

## Copy And Visual Direction

- Remove copy that explains the event mechanics.
- Keep only labels needed to operate the current screen.
- Use the existing near-black, warm-white, cyan, amber, coral, and stripe
  language.
- Prefer one strong action to multiple equal buttons.
- Use the reference redesign for rhythm and hierarchy, not as a literal source
  of states or business rules.
- Never expose team totals, rankings, or team results before release.

## Verification

Automated and browser verification must cover:

- successful save returns to the overview and shows the snackbar;
- overview reflects the saved amount without a manual refresh;
- editing and deleting remain available only while open;
- scanner and team form always have a large escape route;
- organizer logout remains available from the dashboard;
- `🥞` formatting is consistent in all participant, admin, wall, summary, error,
  and receipt surfaces;
- no domain, lifecycle, RLS, Realtime, or privacy invariant regresses;
- overview, scanner, team form, locked overview, released overview, admin, and
  projector wall are visually inspected at their real target sizes.
