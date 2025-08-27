// Core domain types for Orders page. These mirror your API payloads.
// IMPORTANT: Do not change field names/types to preserve API compatibility.

export type OrderItem = {
  product_id: number;
  product_name?: string | null;
  unit?: string | null;          // Unit of measure (e.g., Kg, Px)
  quantity: number;
  unit_price?: number | null;    // Provided by API in GET /orders/:id
  total_price?: number | null;   // Legacy total per item (kept for compatibility)
};

export type Order = {
  id: number;
  delivery_date: string; // ISO (YYYY-MM-DD)
  customer_id: number;
  customer_name?: string | null;
  applied_discount?: number | null;
  status?: 'created' | 'delivered';
  items: OrderItem[];
  total_amount?: number | null;   // Correct total (preferred)
  total_price?: number | null;    // Legacy fallback
  note?: string | null;
};