// Domain types specific to the Lots area.
// Mirrors the backend contract so the page can be self-contained.

export type LotOrderItem = {
  id: number;
  order_id: number;
  order_date: string; // ISO YYYY-MM-DD
  product_id: number;
  quantity: number;
  unit_price: number;
  product_name?: string | null;
  product_unit?: string | null;
  customer_id?: number | null;
  customer_name?: string | null;
};

export type Lot = {
  id: number;
  lot_date: string; // ISO YYYY-MM-DD
  name: string;
  location: string;
  description?: string | null;
  order_items: LotOrderItem[];
};

export type SortParam = {
  field: 'name' | 'lot_date' | 'id' | 'location';
  order: 'asc' | 'desc';
};

/** Whitelist of sortable fields accepted by the backend. */
export const allowedSortFields = new Set([
  'name',
  'lot_date',
  'location',
  'id',
] as const);

export type OrderOptionItem = {
  id: number;
  product_id: number;
  product_name?: string | null;
  unit?: string | null;
  quantity: number;
  lot_id?: number | null;
  lot_name?: string | null;
  lot_location?: string | null;
};

export type OrderOption = {
  id: number;
  customer_id: number;
  customer_name?: string | null;
  delivery_date: string;
  items: OrderOptionItem[];
};
