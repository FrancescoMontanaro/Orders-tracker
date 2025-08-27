import * as React from 'react';
import type { OrderItem } from '../types/dailySummary';

// Compute subtotal/discount/total preview client-side for order creation dialogs
export function usePreviewTotals(items: OrderItem[], appliedDiscount?: number | '' | null) {
  return React.useMemo(() => {
    const withPrices = items.filter((it) => typeof it.unit_price === 'number');
    const subtotal = withPrices.reduce(
      (acc, it) => acc + (Number(it.unit_price) * Number(it.quantity || 0)),
      0
    );
    const discountPerc = appliedDiscount === '' || appliedDiscount == null ? 0 : Number(appliedDiscount);
    const discountAmount = subtotal * (discountPerc / 100);
    const total = subtotal - discountAmount;
    const hasMissingPrices = items.some((it) => Number(it.product_id) > 0 && (it.unit_price == null));
    return { subtotal, discountAmount, total, hasMissingPrices };
  }, [items, appliedDiscount]);
}