/** Format ISO date (YYYY-MM-DD) as DD/MM/YYYY. Fallback to input on mismatch. */
export function formatLotDate(iso?: string | null) {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}
