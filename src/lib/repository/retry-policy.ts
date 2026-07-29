const RETRY_DELAYS = [2_000, 5_000, 30_000] as const;

// A venue-wide outage disconnects every phone at once. Without jitter they all
// reconnect on the same tick and each full snapshot fans out into ten requests,
// so the spike lands while Supabase is still recovering.
const JITTER_RATIO = 0.25;

export function retryDelay(
  attempt: number,
  random: () => number = Math.random,
): number {
  const index = Math.max(0, Math.min(attempt - 1, RETRY_DELAYS.length - 1));
  const base = RETRY_DELAYS[index];
  return Math.round(base * (1 + JITTER_RATIO * random()));
}
