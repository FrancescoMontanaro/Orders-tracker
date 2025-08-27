// Date utilities used by the report views.
// These are intentionally tiny and pure to keep components lean.

/** Format ISO date (YYYY-MM-DD) to dd-mm-yyyy for display. */
export function fmtDate(iso?: string): string {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : iso;
}

/** Add `days` to a base Date and return a *new* Date (no mutation). */
export function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

/** Convert a Date object to YYYY-MM-DD (zero-padded) for inputs/API. */
export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
}