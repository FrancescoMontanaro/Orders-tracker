'use client';

import * as React from 'react';
import { LotOrderItem } from '../types/lot';
import { Badge } from '@/components/ui/badge';
import { formatLotDate } from '../utils/date';

type CustomerGroup = {
  customerId: number | null;
  customerName: string;
  orders: Array<{
    orderId: number;
    order_date: string; // ISO YYYY-MM-DD
    items: LotOrderItem[];
  }>;
};

/**
 * Renders lot items grouped by customer, then by order.
 * Compact but readable and responsive thanks to the stacked layout.
 */
export function LotItemsCell({ items }: { items: LotOrderItem[] }) {
  const groups = React.useMemo<CustomerGroup[]>(() => {
    if (!items?.length) return [];

    const map = new Map<number | null, CustomerGroup>();

    items.forEach((item) => {
      const customerId = item.customer_id ?? null;
      const customerName = item.customer_name ?? `Cliente #${customerId ?? 'n/d'}`;
      const orderId = item.order_id;
      const order_date = item.order_date;

      if (!map.has(customerId)) {
        map.set(customerId, {
          customerId,
          customerName,
          orders: [],
        });
      }

      const group = map.get(customerId)!;
      let orderGroup = group.orders.find((o) => o.orderId === orderId);
      if (!orderGroup) {
        orderGroup = { orderId, order_date, items: [] };
        group.orders.push(orderGroup);
      }
      orderGroup.items.push(item);
    });

    return Array.from(map.values()).map((group) => ({
      ...group,
      orders: group.orders.sort((a, b) => a.orderId - b.orderId),
    }));
  }, [items]);

  if (!items?.length) return <span className="text-muted-foreground">—</span>;

  return (
    <div className="flex flex-col gap-2 min-w-0">
      {groups.map((group) => (
        <div
          key={group.customerId ?? 'nc'}
          className="rounded-lg border border-muted bg-muted/30 p-2 space-y-1.5"
        >
          <div className="text-xs font-semibold uppercase text-muted-foreground">
            {group.customerName}
          </div>

          {group.orders.map((order) => (
            <div
              key={order.orderId}
              className="rounded-md border border-dashed bg-background/80 p-2 space-y-1"
            >
              <div className="flex items-center justify-between gap-2 text-sm font-medium">
                <span>Ordine #{order.orderId} · {formatLotDate(order.order_date)}</span>
                <span className="text-xs text-muted-foreground">
                  {order.items.length} prodotti
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {order.items.map((item) => (
                  <span
                    key={item.id}
                    className="inline-flex items-center gap-1 rounded-md border bg-muted px-2 py-0.5 text-xs leading-tight"
                  >
                    <span className="truncate max-w-[160px]">
                      {item.product_name ?? `Prodotto #${item.product_id}`} ({item.product_unit})
                    </span>
                    <Badge
                      variant="secondary"
                      className="shrink-0 rounded-sm px-1.5 py-0.5 text-[11px] font-semibold"
                    >
                      ×{item.quantity}
                    </Badge>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
