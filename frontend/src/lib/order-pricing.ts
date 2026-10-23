/** Discount modes supported by the orders API. */
export type DiscountType = 'percentage' | 'fixed';

/** Order-level amounts shown separately from full product prices. */
export type OrderAmounts = { subtotal: number; discountAmount: number; total: number };

type PricedItem = {
  quantity: number;
  unit_price?: number | null;
  net_amount?: number | null;
  gross_amount?: number | null;
};

// Scale the tolerance with the amount so binary ties such as 80.35 × 0.9 round up.
const roundMoney = (value: number): number =>
  Math.round((value + Number.EPSILON * Math.max(1, Math.abs(value))) * 100) / 100;

/** Preview order amounts; persisted net line amounts from the API take precedence. */
export function calculateOrderPricing(
  items: readonly PricedItem[],
  appliedDiscount: number | '' | null | undefined = 0,
  discountType: DiscountType = 'percentage',
) {
  const amounts = items.map((item) => Number(item.quantity || 0) * Number(item.unit_price ?? 0));
  const rawSubtotal = amounts.reduce((sum, amount) => sum + amount, 0);
  const subtotal = roundMoney(rawSubtotal);
  const discount = appliedDiscount === '' || appliedDiscount == null ? 0 : Number(appliedDiscount);
  const hasMissingPrices = items.some((item) => item.unit_price == null);
  let validationError: string | null = null;

  if (!Number.isFinite(discount) || discount < 0 || Math.abs(discount - roundMoney(discount)) > 1e-8) {
    validationError = 'Inserisci uno sconto positivo o zero, con al massimo due decimali.';
  } else if (discountType === 'percentage' && discount > 100) {
    validationError = 'Lo sconto percentuale deve essere compreso tra 0 e 100.';
  } else if (discountType === 'fixed' && !hasMissingPrices && discount - rawSubtotal > Number.EPSILON * Math.max(1, rawSubtotal) * 4) {
    validationError = "Lo sconto in euro non può superare il subtotale dell'ordine.";
  }

  const rawTotal = discountType === 'fixed' ? rawSubtotal - discount : rawSubtotal * (1 - discount / 100);
  const total = roundMoney(Math.max(0, Number.isFinite(rawTotal) ? rawTotal : 0));
  let cumulative = 0;
  let allocated = 0;
  let grossAllocated = 0;
  const grossLineTotals: number[] = [];
  const lineTotals = amounts.map((amount, index) => {
    cumulative += amount;
    const grossTarget = roundMoney(cumulative);
    grossLineTotals.push(items[index].gross_amount ?? roundMoney(grossTarget - grossAllocated));
    grossAllocated = grossTarget;
    const target = rawSubtotal ? roundMoney(cumulative * total / rawSubtotal) : 0;
    const net = roundMoney(target - allocated);
    allocated = target;
    return items[index].net_amount ?? net;
  });

  return { subtotal, discountAmount: roundMoney(subtotal - total), total, lineTotals, grossLineTotals, hasMissingPrices, validationError };
}

/** Show the stored discount in its original unit. */
export function formatDiscount(value: number, discountType: DiscountType = 'percentage'): string {
  return discountType === 'fixed'
    ? new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value)
    : `${new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 }).format(value)}%`;
}
