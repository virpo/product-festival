-- refresh_event_stats is an internal trigger/seed helper. Keep callers from
-- overwriting bonus-aware event_stats through a public PostgREST RPC call.
revoke all on function public.refresh_event_stats(uuid) from public, anon, authenticated;
