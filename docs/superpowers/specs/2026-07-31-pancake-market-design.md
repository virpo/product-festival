# Pancake Market Design

## Goal

After results are released, let each team use the private currency it received to choose one pancake filling combination that Virpo (Peter) will invite the team to enjoy. Keep team totals and choices private, preserve the existing no-ranking rule, and give organizers enough information to configure prices and fulfill the invitations.

## Lifecycle

The market uses the existing `draft → open → locked → released` lifecycle. There is no additional market state.

- Organizers may configure the package catalogue in `draft`, `open`, and `locked`.
- The catalogue freezes permanently when results become `released`.
- Teams may see and choose packages only in `released`.
- Team totals and selections never appear on the public wall or public summary.

This keeps the existing rule that private team results remain hidden until release. Organizers may privately see provisional team totals before release so they can calibrate package prices.

## Default catalogue

Each event has exactly seven package rows. The default catalogue uses the requested order and prices:

| Position | Package | Default price |
| ---: | --- | ---: |
| 1 | Nugátová plnka + jahodový kompót | 700 🥞 |
| 2 | Čoko-oriešková plnka + banánová plnka | 600 🥞 |
| 3 | Sladký tvaroh + čerešňový džem | 500 🥞 |
| 4 | Maková plnka + slivkový džem | 400 🥞 |
| 5 | Kávová plnka + tekutý karamel | 300 🥞 |
| 6 | Gaštanový krém + mandarínkový kompót + šľahačka | 200 🥞 |
| 7 | Bryndza + kakaový prášok | 100 🥞 |

Organizers may edit every package name, price, and display position before release. A catalogue save is atomic and must contain:

- exactly seven packages;
- seven non-empty names;
- unique positions 1 through 7;
- positive whole-number prices; and
- strictly descending prices in display order, so the top package remains the most expensive.

The database is authoritative. Client-side validation exists for immediate feedback, but the organizer-only catalogue RPC repeats every rule and rejects writes once the event is `released`.

## Accounting and selection rules

A team’s market balance is its existing private receipt total:

```text
team balance = sum(signal.amount where signal.team_id = team.id)
```

All received signals count, matching the amount already shown on the team receipt. Festival Spark bonuses do not count because they increase an investor’s wallet rather than the recipient team’s total.

Each active team may hold exactly one package selection per event. Any current member of that team may create or replace the shared selection after release. A valid selection requires:

- an authenticated person derived by the server from Supabase Auth;
- current membership in the active target team;
- an event in `released`;
- a package belonging to the same event; and
- a package price less than or equal to the server-calculated team balance.

Selecting a package does not debit a ledger. Because a team can hold only one active package, every replacement is validated against the stable released receipt total. Concurrent valid writes use one atomic upsert; the last completed write becomes the team’s shared choice.

Organizers can read every team’s balance and selection for configuration and fulfillment. They cannot choose a package on a team’s behalf. Team members can read only their own team’s selection. Direct catalogue and selection-table writes are blocked; mutations use dedicated security-definer RPCs with server-derived identity and event-state checks.

## Participant experience

The market is embedded in the existing private `/results` screen rather than added as a separate route. After release, `TeamReceipt` places a **Palacinková burza** section between the team-total header and the feedback receipt.

The section explains in Slovak that Virpo (Peter) missed the week and is inviting the team for pancakes. It shows the team’s earned balance and all seven configured packages in organizer-defined order.

- Each package card shows its name and price.
- Affordable packages offer a **Vybrať** action.
- Unaffordable packages remain visible, disabled, and state how many 🥞 are missing.
- The current shared choice is marked **Vybrané pre tím**.
- Choosing another affordable package replaces the selection without leaving the results page.
- While a save is pending, selection controls are disabled.
- Success is acknowledged inline. A failed write preserves the previous persisted choice and presents a retryable error.
- If the team balance is below the cheapest package, the full catalogue remains visible with a clear explanation.

An organizer inspecting a team through the existing `/results` team selector may see that team’s balance and current choice but receives read-only package controls.

## Organizer experience

The private `/admin` dashboard gains a pancake-market area.

### Before release

The area has two related sections:

1. **Current team amounts** lists every active team and its received total in team-number order. It never sorts by balance or labels a rank or winner. During `open`, copy identifies these values as live and provisional. In `locked`, copy identifies them as final.
2. **Package editor** shows seven rows with a name input, whole-number price input, and up/down controls for display order. One **Save market settings** action validates and writes the complete catalogue atomically. Validation or persistence errors preserve unsaved inputs and identify the problem inline.

Normal repository invalidation performs a full snapshot refetch, so organizer totals follow incoming investments without publishing raw signals or team totals through Realtime.

### After release

The catalogue becomes read-only. The same area shows a private fulfillment list in team-number order with:

- team name and number;
- earned balance;
- selected package and its price;
- selecting person and selection time; or
- an explicit not-yet-selected state.

The fulfillment list is operational, not competitive: it has no rank, winner, balance sorting, or public link.

## Data and repository design

Add an event-scoped package catalogue and one selection row per team. The catalogue owns package name, positive integer price, and unique display position. The selection references the event, team, package, selecting person, and selection timestamp, with a unique event/team constraint.

Extend the repository contract and snapshot data required by authenticated clients with:

- catalogue reads;
- private selection reads filtered by RLS;
- an organizer catalogue-save command; and
- a team package-selection command.

The Supabase adapter maps catalogue and visible selection rows, then calls the dedicated RPCs. Catalogue configuration and package selection trigger the same full-snapshot refresh pattern as existing commands. Neither table is added to the Realtime publication.

Demo mode stores the catalogue and selections with the local snapshot, enforces the same lifecycle, validation, membership, affordability, and replacement behavior, broadcasts invalidation to other demo tabs, and clears the added state on demo reset.

## Security and failure behavior

RLS allows organizers to read the catalogue in every event state and all team selections. Authenticated team members may read the catalogue and their own team’s selection only after release. Other participants and unauthenticated clients receive neither catalogue nor selection rows. Direct client writes are denied.

Server-side RPC enforcement rejects:

- non-organizer catalogue changes;
- malformed catalogues;
- catalogue changes after release, including stale admin tabs;
- package selections before release;
- selections by non-members or members of archived teams;
- cross-event package references; and
- unaffordable selections.

A rejected selection never replaces the previously persisted choice. A rejected catalogue save never partially updates the seven rows.

## Verification

Automated coverage includes:

- domain catalogue validation, strict price ordering, team-total calculation, and exact affordability boundaries;
- demo repository configuration windows, release freeze, member-only shared selection, replacement, unaffordable rejection, cross-event rejection, concurrent observable behavior, and reset cleanup;
- Supabase adapter and schema-contract coverage for catalogue/selection mapping, organizer-only configuration, member-only selection, atomicity, RLS privacy, and exclusion from Realtime;
- participant component coverage for release gating, affordable and disabled cards, missing-amount copy, selected state, replacement, pending state, and persistence failures;
- admin component coverage for provisional/final totals, team-number ordering, catalogue editing and validation, release freeze, and fulfillment states; and
- regression coverage proving public wall and summary surfaces expose no team amount, choice, ranking, or winner.

Completion requires the full test suite, lint, and production build. Browser verification covers the mobile participant results and package-replacement flow, the organizer catalogue editor and fulfillment list, and the projector wall to confirm that team amounts and package choices remain private.
