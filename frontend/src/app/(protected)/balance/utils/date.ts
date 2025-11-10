/**
 * Formats ISO date ("YYYY-MM-DD") to "dd-mm-yyyy".
 * If the input doesn't match the expected shape, returns it unchanged.
 */
export function fmtDate(iso?: string) {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : iso;
}