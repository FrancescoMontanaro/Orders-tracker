/**
 * Compose the lot name based on date and location.
 * Format: yyyymmdd + space + location (trimmed).
 */
export function composeLotName(lotDate: string, location: string): string {
  const trimmedLocation = location.trim();
  if (!lotDate || !trimmedLocation) return '';

  const compactDate = lotDate.replace(/-/g, '');
  if (!/^\d{8}$/.test(compactDate)) return '';

  return `${compactDate} ${trimmedLocation}`;
}
