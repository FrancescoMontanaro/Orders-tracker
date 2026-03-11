/**
 * Compose the lot name based on date and location.
 * Format: yyyymmdd when no location, yyyymmdd + space + location when location is provided.
 */
export function composeLotName(lotDate: string, location: string): string {
  if (!lotDate) return '';

  const compactDate = lotDate.replace(/-/g, '');
  if (!/^\d{8}$/.test(compactDate)) return '';

  const trimmedLocation = location.trim();
  if (!trimmedLocation) return compactDate;

  return `${compactDate} ${trimmedLocation}`;
}
