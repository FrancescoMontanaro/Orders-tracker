// Domain types for the Products area. Kept local to this section
// to avoid cross-area coupling and make the page self-contained.

export type Product = {
  id: number;
  name: string;
  unit_price: number;
  unit: 'Kg' | 'Px';
  is_active: boolean;
};

export type SortParam = {
  field: 'name' | 'unit' | 'is_active' | 'unit_price';
  order: 'asc' | 'desc';
};

/** Whitelist used to protect server-side sorting parameters. */
export const allowedSortFields = new Set([
  'name',
  'unit',
  'is_active',
  'unit_price',
] as const);