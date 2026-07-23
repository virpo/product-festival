# Product Festival 🎪 — Product Design

## Communication job

By the end of the festival, every builder should have put a usable product into other people's hands and received a private, named set of concrete signals about whether and how to continue.

## Product boundary

Product Festival is a reusable, single-event web app for demo days and build weeks. It is not a startup competition, payment product, ticketing system, or event platform.

The app supports four roles:

- participants, who may also belong to a team;
- mentors;
- organizers;
- observers.

Every person receives a configurable fake-money wallet. A signal combines an optional investment with required written or recorded feedback. Team totals are never shown on the public wall. Team receipts remain private until an organizer releases them.

## Chosen approach

The production data source is Supabase: Auth, Postgres, Realtime, and private Storage. A deterministic demo adapter mirrors the same commands in the browser so the complete interface can be built and tested before Supabase credentials exist.

This is preferable to:

- a Supabase-only UI that cannot be exercised until infrastructure is provisioned;
- a server-heavy Next.js application with service-role endpoints and email login, which adds deployment and security surface without helping a one-room event.

The app uses anonymous Supabase Auth plus organizer-created access codes. Claiming a code binds the authenticated browser user to one person record. Row-level security remains the source of authorization.

## Event lifecycle

An event has four explicit states:

1. `draft` — organizers configure teams, people, wallets, URLs, timing, and QR sheets;
2. `open` — people scan teams, record visits, send or edit signals, and rebalance wallets;
3. `locked` — all investments and feedback become read-only while organizers close the room;
4. `released` — private team receipts unlock and the public collective summary remains available.

State moves only forward in the normal UI. A separate organizer reset action creates a fresh demo event rather than silently reopening a finished event.

## Rules

- Default wallet: `€100`, configurable per event and overridable per person.
- Default maximum for one team: `€50`, configurable per event.
- A team member cannot invest in their own team.
- Wallets cannot go below zero.
- Investment amount is an integer from `€0` to the event maximum.
- `€0` is allowed as feedback-only; non-zero signals represent "I want to see where this goes."
- Every saved signal needs written feedback, a recording, or both.
- One person has at most one signal per team; editing replaces that signal.
- Scanning a team records a visit independently of investing.
- The coverage goal defaults to `75%` of teams and stays a soft facilitation signal, not an app gate.
- People may edit or remove signals only while the event is open.
- Named team feedback becomes visible only after release.

## Participant experience

### Join

The first screen asks for an access code. In demo mode, the screen also exposes clearly labelled participant, mentor, organizer, and observer entries. A successful claim persists in the browser.

### Home / scanner

The participant home is mobile-first. It leads with:

- remaining wallet;
- visited-team progress;
- one prominent `Skenovať QR kód` action;
- a secondary manual team-code input;
- a compact link to `Moje investície`.

The camera view uses the rear camera when available. Permission denial, unsupported browsers, and insecure origins fall back to manual entry without blocking the flow.

### Team

Scanning a team QR opens `/t/[code]`, records a visit, and shows only what is useful at the table:

- team number and name;
- one-line description;
- `Vyskúšať produkt` when a product URL exists;
- exact amount input with `−` and `+`;
- remaining wallet;
- feedback textarea;
- record/stop/play/delete controls for one audio note;
- save button.

If the viewer belongs to the team, the page explains that they cannot invest in themselves and points back to the scanner.

### Confirmation and portfolio

After saving, the app confirms the amount and feedback, then makes `Skenovať ďalší QR kód` the strongest action.

The portfolio is a compact editable ledger:

- remaining wallet and coverage first;
- one row per team;
- direct amount editing;
- direct feedback editing;
- recording state;
- remove action;
- read-only state after lock.

## Organizer / CRM

The organizer surface is deliberately utilitarian. It has five sections:

1. **Overview** — event state, countdown, room statistics, low-coverage people, lock, and release controls.
2. **Teams** — add/edit/remove team, team number, description, product URL, table label, color, and members.
3. **People** — add/edit/remove person, role, wallet, team assignment, access code, and claim state.
4. **QR codes** — printable team cards, single download, and print-all.
5. **Settings** — event name, slug, currency, wallet default, per-team maximum, coverage target, opening time, and lock time.

Destructive controls require confirmation. Event lifecycle controls are visually separate from ordinary edits.

## Public wall

The projector route is readable from across a room and subscribes to aggregate realtime state. It shows:

- event state;
- time until lock while open;
- active people;
- signals with feedback;
- total fake money invested;
- average visited teams;
- percentage of people at or above the coverage target;
- a restrained pulse when aggregate activity changes.

It never shows team totals, rankings, investor names, or recent team-level activity.

When locked, the wall becomes a collective receipt. When released, it links to the public summary.

## Results

### Public summary

The public summary contains only aggregate event outcomes:

- number of teams and people;
- total visits, signals, feedback notes, recordings, and fake money;
- coverage distribution;
- role participation;
- final timing.

### Private team receipt

Team members see:

- total signal amount;
- number of people who responded;
- each sender's name and role;
- amount;
- written feedback;
- playable recorded feedback.

There is no rank or comparison to other teams.

## Data model

- `events`
- `teams`
- `people`
- `team_members`
- `visits`
- `signals`
- `event_stats`

`event_stats` is an aggregate row maintained by Postgres triggers. It is safe for public selection and Realtime subscription. Raw signals remain private.

Audio files live in a private `feedback-audio` Storage bucket. Upload paths contain the event, sender, and team ids. Storage policies allow senders to manage their own files while the event is open and allow recipient team members to read them only after results are released.

## Realtime and offline behavior

Supabase mode subscribes to the event and its `event_stats` row. Organizer and participant views refresh their authorized records after relevant changes. The public wall never subscribes to private tables.

Demo mode stores the same snapshot in `localStorage` and synchronizes tabs with `BroadcastChannel`. It is explicitly labelled as demo data and is not presented as durable production storage.

Optimistic edits show a saving state and roll back with a concrete error when persistence fails. Camera and microphone errors keep text/manual paths usable.

## Visual direction

The Claude Design board is the source of truth:

- near-black background;
- warm white text;
- cyan, amber, and coral as restrained functional accents;
- Space Grotesk for display/UI labels and Instrument Sans for body copy;
- three slanted AI Build Week stripes as the compact event mark;
- mobile participant views that feel tactile but simple;
- a less theatrical, denser organizer CRM;
- a public wall with projector-scale numbers and no dashboard clutter.

No generic fintech styling, glossy card grids, fake AI copy, public leaderboard, or decorative copy that the interface can explain itself.

## Technical shape

- Next.js `16.2.x` App Router
- React `19.2.x`
- TypeScript with strict mode
- Supabase JavaScript client `2.110.x`
- `html5-qrcode` for scanning
- `qrcode.react` for team codes
- MediaRecorder for audio capture
- Vitest and Testing Library for unit/component tests
- Playwright-style browser smoke checks through the available browser tooling
- Vercel- and Netlify-compatible Next.js deployment

## Verification

Automated coverage must prove:

- wallet and per-team constraints;
- own-team protection;
- feedback requirement;
- event-state write protection;
- coverage calculations;
- portfolio editing;
- no leaderboard/team totals on the public wall;
- organizer CRUD and lifecycle controls;
- QR target parsing;
- demo cross-tab updates;
- Supabase schema policies and trigger definitions are present.

The production build must pass without Supabase credentials by rendering demo mode. Browser verification covers participant, organizer, wall, and released-results routes at mobile and desktop widths.
