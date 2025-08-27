/** Convert ISO date (YYYY-MM-DD) to dd-mm-yyyy. If pattern does not match, return input as-is. */
export function fmtDate(iso?: string) {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : iso;
}