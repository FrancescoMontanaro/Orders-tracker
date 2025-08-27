// Centralized currency helpers used by the report views.
// Keeping a single Intl.NumberFormat instance avoids re-creating it on every render.

export const euroFmt = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
});

/** Format a possibly-null/undefined number to EUR. */
export function euro(n?: number | null): string {
  return euroFmt.format(Number(n ?? 0));
}