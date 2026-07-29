export const ACCESS_CODE_MAX_LENGTH = 24;

export function normalizeAccessCode(value: string): string {
  return value.trim().toUpperCase();
}
