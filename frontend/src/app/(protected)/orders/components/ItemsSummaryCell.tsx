import * as React from 'react';
import { OrderItem } from '../types/order';

/**
 * Small, legible summary of ordered items as little pills.
 * Truncates after 4 items and shows a “+N” counter for the rest.
 */
export function ItemsSummaryCell({ items }: { items: OrderItem[] }) {
  if (!items?.length) return <span className="text-muted-foreground">—</span>;
  const MAX = 4;
  const shown = items.slice(0, MAX);
  const extra = Math.max(0, items.length - shown.length);
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((it, idx) => (
        <span
          key={idx}
          className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs"
          title={`${(it.product_name ?? `#${it.product_id}`)}${it.unit ? ` (${it.unit})` : ''} × ${it.quantity}`}
        >
          <span className="truncate max-w-[20ch]">
            {it.product_name ?? `#${it.product_id}`}
            {it.unit ? ` (${it.unit})` : ''}
          </span>
          <span className="ml-1 opacity-70">×{it.quantity}</span>
        </span>
      ))}
      {extra > 0 && (
        <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs">+{extra}</span>
      )}
    </div>
  );
}