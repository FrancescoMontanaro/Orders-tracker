import * as React from 'react';
import type { OrderItem } from '../types/dailySummary';
import { calculateOrderPricing, type DiscountType } from '@/lib/order-pricing';

/** Preview the same discount modes as the orders API. */
export function usePreviewTotals(
  items: OrderItem[],
  appliedDiscount?: number | '' | null,
  discountType: DiscountType = 'percentage',
) {
  return React.useMemo(
    () => calculateOrderPricing(items, appliedDiscount, discountType),
    [items, appliedDiscount, discountType],
  );
}
