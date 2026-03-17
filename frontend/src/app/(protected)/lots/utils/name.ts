/**
 * Compose the lot name based on date and location.
 * Format: dd.mm.yyyy when no location, dd.mm.yyyy + space + location when location is provided.
 */
export function composeLotName(lotDate: string, location: string): string {
  if (!lotDate) return '';

  const normalizedDate = lotDate.trim();

  // Accepts yyyy-mm-dd or yyyymmdd
  const match = normalizedDate.match(/^(\d{4})-?(\d{2})-?(\d{2})$/);
  if (!match) return '';

  const [, year, month, day] = match;
  const formattedDate = `${day}.${month}.${year}`;

  const trimmedLocation = location.trim();
  if (!trimmedLocation) return formattedDate;

  return `${formattedDate} ${trimmedLocation}`;
}
