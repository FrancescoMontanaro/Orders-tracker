import * as React from 'react';
import { OrderItem } from '../types/order';

/**
 * Compute subtotal, discount and total for the order preview.
 * - unit_price is *not* sent to the server (kept readonly if provided).
 * - When any item misses unit_price, we flag hasMissingPrices so the UI can warn the user.
 */
export function usePreviewTotals(items: OrderItem[], appliedDiscount?: number | '' | null) {
  return React.useMemo(() => {
    const withPrices = items.filter((it) => typeof it.unit_price === 'number');
    const subtotal = withPrices.reduce((acc, it) => acc + (Number(it.unit_price) * Number(it.quantity || 0)), 0);
    const discountPerc = appliedDiscount === '' || appliedDiscount == null ? 0 : Number(appliedDiscount);
    const discountAmount = subtotal * (discountPerc / 100);
    const total = subtotal - discountAmount;
    const hasMissingPrices = items.some(
      (it) => Number(it.product_id) > 0 && (it.unit_price == null)
    );
    return { subtotal, discountAmount, total, hasMissingPrices };
  }, [items, appliedDiscount]);
}