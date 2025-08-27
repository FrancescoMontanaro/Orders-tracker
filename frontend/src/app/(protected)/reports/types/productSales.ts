/**
 * ProductSalesRow
 * - Represents a single row of product sales data.
 */
export type ProductSalesRow = {
  product_id: number;
  product_name: string;
  unit?: string | null;
  total_qty: number;
  revenue: number;
};