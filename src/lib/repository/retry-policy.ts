const RETRY_DELAYS = [2_000, 5_000, 30_000] as const;

export function retryDelay(attempt: number): number {
  const index = Math.max(0, Math.min(attempt - 1, RETRY_DELAYS.length - 1));
  return RETRY_DELAYS[index];
}
