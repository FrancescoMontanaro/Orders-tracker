/**
 * CustomerSales
 * - Represents the sales data for a single customer.
 */
export type CustomerSales = {
  customer_id: number;
  customer_name: string;
  total_revenue: number;
  per_product: Array<{
    product_id: number;
    product_name: string;
    unit?: string | null;
    total_qty: number;
    avg_discount: number;
    revenue: number;
  }>;
};