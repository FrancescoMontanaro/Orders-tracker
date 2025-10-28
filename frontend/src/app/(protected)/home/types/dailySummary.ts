// Types returned by /widgets/daily-summary

export type DailySummaryCustomer = {
  customer_id: number;
  customer_name: string;
  quantity: number;
  order_status: 'created' | 'delivered' | string;
};

export type DailySummaryProduct = {
  product_id: number;
  product_name: string;
  total_qty: number;
  product_unit: string;
  customers: DailySummaryCustomer[];
};

export type DailySummaryDay = {
  date: string; // YYYY-MM-DD
  products: DailySummaryProduct[];
};

// Minimal order item used in in-page dialogs
export type OrderItem = {
  product_id: number;
  product_name?: string | null;
  unit?: string | null;
  quantity: number;
  unit_price?: number | null;
  total_price?: number | null;
  lot_id?: number | null;
  lot_name?: string | null;
  lot_date?: string | null;
};

// Generic API wrapper
export type SuccessResponse<T> = { status: 'success'; data: T };
