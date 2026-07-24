insert into public.events (
  id,
  name,
  slug,
  status,
  currency,
  wallet_default,
  max_per_team,
  coverage_target,
  opens_at,
  locks_at
)
values (
  '10000000-0000-0000-0000-000000000001',
  'AI Build Week Product Festival',
  'ai-build-week',
  'draft',
  '$',
  100,
  50,
  75,
  '2026-07-31 10:00:00+00',
  '2026-07-31 13:00:00+00'
)
on conflict (slug) do nothing;

select public.refresh_event_stats(id)
from public.events
where slug = 'ai-build-week';
