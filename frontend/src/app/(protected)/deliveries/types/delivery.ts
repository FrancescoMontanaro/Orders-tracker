/**
 * A single product line to prepare (quantities only, no economic data).
 */
export type DeliveryItem = {
  product_id: number;
  product_name: string;
  unit?: string | null;
  quantity: number;
};

/**
 * The products of one order to be delivered.
 * Orders are identified by their id only: no customer data is exposed.
 */
export type DeliveryOrder = {
  order_id: number;
  status: 'created' | 'delivered';
  items: DeliveryItem[];
};

/**
 * The delivery summary of a day.
 */
export type DailyDeliveries = {
  delivery_date: string;
  orders: DeliveryOrder[];
  totals: DeliveryItem[];
};
