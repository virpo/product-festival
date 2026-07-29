function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function toLocalDateTimeInput(iso: string | null): string {
  if (!iso) return "";

  const date = new Date(iso);
  return [
    date.getFullYear(),
    "-",
    pad(date.getMonth() + 1),
    "-",
    pad(date.getDate()),
    "T",
    pad(date.getHours()),
    ":",
    pad(date.getMinutes()),
  ].join("");
}

export function fromLocalDateTimeInput(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}
