// Domain types for the Expenses area. Kept local to keep this feature folder portable.

export type Expense = {
  id: number;
  timestamp: string; // ISO (YYYY-MM-DD)
  amount: number;
  note?: string | null;
};

export type SortParam = {
  field: 'amount' | 'timestamp';
  order: 'asc' | 'desc';
};

/** Whitelist used to protect server-side sorting parameters. */
export const allowedSortFields = new Set(['amount', 'timestamp'] as const);