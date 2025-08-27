// Domain types for the Customers area.
// Kept local so this feature folder is portable as-is.

export type Customer = {
  id: number;
  name: string;
  is_active: boolean;
};

export type SortParam = {
  field: 'id' | 'name' | 'is_active';
  order: 'asc' | 'desc';
};

/** Whitelist used to protect server-side sorting parameters. */
export const allowedSortFields = new Set(['id', 'name', 'is_active'] as const);