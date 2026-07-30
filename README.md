# Product Festival 🎪

Turn demo day into a room full of people actually trying each other’s products.

Each team puts a QR code on its table. People scan it, try the product, invest
some of their fake budget and leave concrete written or recorded feedback. The
projector shows the room moving. At the end, every team gets its own feedback.

It grew out of **AI Build Day**, where participants backed projects they liked
with fake money and QR codes. We adapted the idea for the five-day
**AI Build Week**: instead of spending Friday morning polishing presentations,
teams have to make their product usable by someone else and learn from what
happens.

[Open the AI Build Week festival](https://festival.aibuildweek.com)

## When it is useful

- **A one-day hackathon, like AI Build Day:** turn a row of pitches into quick
  demos, real product trials and a playful signal from the room.
- **A longer program, like AI Build Week:** make “someone else can use it” the
  finish line and send every team home with useful feedback.
- **Accelerators and internal demo days:** let the whole room participate
  instead of separating judges from an audience.

There does not have to be a winner. Here, an investment means: “I want to see
where this goes.”

## What it looks like

The public wall shows shared progress and time, never a team leaderboard.

![Public projector wall showing the live Product Festival](docs/images/public-wall.png)

Participants see their wallet, progress and editable investments in one
overview. Scanning a team opens one compact voice-first feedback screen.

<p align="center">
  <img src="docs/images/participant-entry.png" width="360" alt="Participant overview on a phone">
  &nbsp;&nbsp;&nbsp;
  <img src="docs/images/participant-investment.png" width="360" alt="Voice-first investment and feedback screen on a phone">
</p>

The organizer controls the event and watches participation in real time.

![Product Festival organizer dashboard](docs/images/organizer-dashboard.png)

## What is included

- participant and mentor wallets with configurable budgets;
- team and people CRM with one-time access codes;
- printable and downloadable QR codes for every team;
- browser QR scanner with a manual-code fallback;
- exact investment amounts with `+` / `−` controls;
- written or microphone-recorded feedback;
- wallet, progress and editable investments in one participant overview;
- projector wall with countdown, distributed-budget progress and aggregate activity;
- organizer controls for `draft → open → locked → released`;
- private team receipts after release;
- Supabase Auth, Postgres, Realtime, Storage and RLS;
- a complete local demo mode that needs no account.

## Run the demo

Requires Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Useful demo codes:

| View | Code |
| --- | --- |
| Participant | `PETER` |
| Mentor | `MENTOR` |
| Organizer | `ADMIN` |
| Observer | `GUEST` |

Demo data lives in `localStorage` and syncs between tabs with
`BroadcastChannel`. The organizer can restore the seed from **Nastavenia**.

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Access code and participant home |
| `/scan` | QR camera and manual team code |
| `/t/[code]` | Product, investment and feedback |
| `/portfolio` | Legacy redirect to the participant overview |
| `/admin` | Event, team and people controls |
| `/admin/qr` | Print or download team QR cards |
| `/wall` | Public projector view |
| `/summary` | Collective closing numbers |
| `/results` | Private released team feedback |

## Connect Supabase

The app switches from demo mode to Supabase when both public environment
variables are present.

```bash
cp .env.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
NEXT_PUBLIC_EVENT_SLUG=ai-build-week
NEXT_PUBLIC_APP_ORIGIN=http://localhost:3000
```

Then:

1. Create a Supabase project.
2. Enable anonymous sign-ins in Auth.
3. Link the local folder and apply the migration:

   ```bash
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase db push
   ```

4. Load `supabase/seed.sql` in the SQL editor for the sample event, or replace
   it with your own event, teams and access codes.
5. Run `npm run dev` again.

The browser receives only the publishable key. Never add a service-role key to
this app. Raw feedback and audio are protected by RLS and a private Storage
bucket. Realtime publishes shared room state only: event lifecycle, aggregate
stats, teams, people and team membership. It never publishes access codes,
visits, signals or audio metadata.

Official references:
[anonymous auth](https://supabase.com/docs/guides/auth/auth-anonymous),
[Realtime database changes](https://supabase.com/docs/guides/realtime/postgres-changes),
[Storage access control](https://supabase.com/docs/guides/storage/security/access-control).

## Event flow

1. **Draft** — add people and teams, assign wallets, print QR cards.
2. **Open** — scanning, visits, investments and feedback are editable.
3. **Locked** — all participant writes stop; private receipts remain hidden.
4. **Released** — each team sees its named amounts, text and recordings.

Transitions only move forward. A public screen never exposes team totals or a
ranking.

## Live-event recovery

- Give every organizer a separate organizer code. Do not share one logged-in
  organizer identity across devices.
- An access code belongs to one active browser. A second browser must explicitly
  take it over; the previous browser returns to entry after its next refresh.
- Person, access-code and team-assignment edits are one atomic operation.
- The browser refetches after Realtime changes. If the connection drops, it
  keeps the last snapshot visible, warns that it may be stale, and retries after
  roughly 2 seconds, 5 seconds, then every 30 seconds. Each delay carries up to
  25% jitter so a venue-wide outage does not reconnect every phone on the same
  tick, so the observed waits reach about 2.5, 6 and 37 seconds.
- Locking and releasing are separate manual actions. A reconnect never advances
  the event automatically.
- Fresh recording links last six hours. Reloading results creates fresh links.

## Deploy

Vercel:

```bash
npx vercel
```

Netlify:

```bash
npx netlify-cli deploy
```

Set the four public environment variables in the host and use the final HTTPS
origin for `NEXT_PUBLIC_APP_ORIGIN`. Camera access requires HTTPS outside
localhost.

## Verify

```bash
npm test -- --run
npm run lint
npm run build
```

## License

MIT. See [LICENSE](./LICENSE).
