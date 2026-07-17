export type CashflowEntry = { order_id: number; date: string; amount: number };
export type CashflowExpense = { id: number; date: string; amount: number; note?: string | null };
export type CashflowIncome = { id: number; date: string; amount: number; note?: string | null };

export type CashflowResponse = {
  entries_total: number;
  expenses_total: number;
  net: number;
  entries: CashflowEntry[];
  expenses: CashflowExpense[];
  incomes: CashflowIncome[];
};

/** Row returned by /reports/expenses and /reports/incomes (per-category totals) */
export type CategoryRow = {
  category_id: number;
  category_descr: string;
  amount: number;
  count: number;
};

export type Granularity = 'daily' | 'monthly' | 'yearly';
export type CompareMode = 'previous' | 'year';
export type SuccessResponse<T> = { status: 'success'; data: T };
