// Domain types for the Incomes area. Mirrors the Expenses slice for consistency.

export type Income = {
  id: number;
  category_id: number;
  category: string;
  timestamp: string;
  amount: number;
  note?: string | null;
};

export type IncomeCategory = {
  id: number;
  descr: string;
};

export type IncomeSortParam = {
  field: 'amount' | 'timestamp' | 'category';
  order: 'asc' | 'desc';
};

/** Whitelist used to protect server-side sorting parameters. */
export const allowedIncomeSortFields = new Set(['amount', 'timestamp', 'category'] as const);
