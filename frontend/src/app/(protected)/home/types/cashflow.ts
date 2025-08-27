export type CashflowEntry = { order_id: number; date: string; amount: number };
export type CashflowExpense = { id: number; date: string; amount: number; note?: string | null };

export type CashflowResponse = {
  entries_total: number;
  expenses_total: number;
  net: number;
  entries: CashflowEntry[];
  expenses: CashflowExpense[];
};

export type Granularity = 'daily' | 'monthly' | 'yearly';
export type SuccessResponse<T> = { status: 'success'; data: T };