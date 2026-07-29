# Product Festival 🎪

Standalone Next.js app for QR product testing, fake-money signals and private
feedback receipts.

## Shape

- `src/lib/domain` — framework-free rules and aggregate stats.
- `src/lib/repository` — one interface, local demo and Supabase adapters.
- `src/components/participant` — mobile scanner, signal form and portfolio.
- `src/components/admin` — utilitarian CRM and QR sheets.
- `src/components/wall` — aggregate-only projector view.
- `src/components/results` — collective summary and private receipts.
- `supabase` — schema, RLS, Realtime, Storage policies and sample seed.

## Invariants

- No public team totals, ranking or winner.
- One editable signal per person and team.
- Text or audio feedback is required; amount may be zero.
- No own-team investment, overspending or writes outside `open`.
- Results stay private until `released`.
- One person has one active Auth identity; takeover must be explicit.
- Use separate people and codes for concurrent organizers.
- Person, access-code and membership writes stay inside one RPC transaction.
- The current and last organizer cannot be removed or demoted.
- Team membership freezes after the person sends their first signal.
- Visits are authenticated, foreign-team only and writable only in `open`.
- Realtime is an invalidation hint. Reconnects always refetch a full snapshot.
- Never publish access codes, visits, signals or audio metadata through Realtime.
- Event status changes only through `advance_event`; settings use their own RPC.
- Never expose a Supabase service-role key.
- Demo mode must keep working without environment variables.

## Operations

- Supabase project login: `hello@aibuildweek.com`.
- Netlify project: `ai-build-week-product-festival` in the `Pumpkings` team.
- Production domain: `https://festival.aibuildweek.com`.

Run tests, lint and production build before calling work complete. Verify mobile
participant screens and the projector wall in a real browser.
