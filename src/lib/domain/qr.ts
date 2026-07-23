const CODE_PATTERN = /^[A-Z0-9][A-Z0-9-]{2,31}$/;

export function parseTeamCode(value: string): string | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  let candidate = trimmed;

  try {
    const url = new URL(trimmed);
    const match = url.pathname.match(/\/t\/([^/]+)/i);
    candidate = match?.[1] ?? "";
  } catch {
    // Raw team codes are expected here.
  }

  const normalized = decodeURIComponent(candidate).trim().toUpperCase();
  return CODE_PATTERN.test(normalized) ? normalized : null;
}
