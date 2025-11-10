// Domain types for the Expenses area. Kept local to keep this feature folder portable.

// Expense now carries the category foreign key and the resolved category label
export type Expense = {
  id: number;
  category_id: number;   // FK to ExpenseCategory
  category: string;      // resolved category description from API
  timestamp: string;     // ISO (YYYY-MM-DD)
  amount: number;
  note?: string | null;
};

// Single category (used for filters/selects)
export type ExpenseCategory = {
  id: number;
  descr: string;
};

// Sort fields now include "category" if the backend allows sorting by category description
export type SortParam = {
  field: 'amount' | 'timestamp' | 'category';
  order: 'asc' | 'desc';
};

/** Whitelist used to protect server-side sorting parameters. */
export const allowedSortFields = new Set(['amount', 'timestamp', 'category'] as const);