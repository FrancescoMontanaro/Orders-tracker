// Domain types specific to the Lots area.
// Mirrors the backend contract so the page can be self-contained.

export type LotOrderItem = {
  id: number;
  order_id: number;
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
  description?: string | null;
  order_items: LotOrderItem[];
};

export type SortParam = {
  field: 'name' | 'lot_date' | 'id';
  order: 'asc' | 'desc';
};

/** Whitelist of sortable fields accepted by the backend. */
export const allowedSortFields = new Set([
  'name',
  'lot_date',
  'id',
] as const);

export type OrderOptionItem = {
  id: number;
  product_id: number;
  product_name?: string | null;
  unit?: string | null;
  quantity: number;
};

export type OrderOption = {
  id: number;
  customer_id: number;
  customer_name?: string | null;
  delivery_date: string;
  items: OrderOptionItem[];
};
