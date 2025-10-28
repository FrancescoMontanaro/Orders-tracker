export type LotOption = {
  id: number;
  name: string;
  lot_date: string;
  location: string;
  description?: string | null;
};

/** Format YYYY-MM-DD into a friendly Italian date (e.g., 12/05/2024). */
export function formatLotOptionDate(iso?: string | null) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}
