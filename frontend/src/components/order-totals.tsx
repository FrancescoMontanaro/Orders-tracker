import type { OrderAmounts } from '@/lib/order-pricing';

const euro = (amount: number): string =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(amount);

/** Keep the order discount separate from product prices in customer summaries. */
export function OrderTotals({ subtotal, discountAmount, total }: OrderAmounts) {
  return (
    <dl className="ml-auto grid w-full min-w-0 max-w-sm gap-1 border-t pt-2 text-sm">
      {discountAmount > 0 && (
        <>
          <div className="flex justify-between gap-2 text-muted-foreground">
            <dt>Subtotale</dt>
            <dd className="shrink-0 tabular-nums">{euro(subtotal)}</dd>
          </div>
          <div className="flex justify-between gap-2 text-muted-foreground">
            <dt className="min-w-0 break-words">Sconto sull&apos;ordine</dt>
            <dd className="shrink-0 tabular-nums">−{euro(discountAmount)}</dd>
          </div>
        </>
      )}
      <div className="flex justify-between gap-2 font-semibold">
        <dt>Totale</dt>
        <dd className="shrink-0 tabular-nums">{euro(total)}</dd>
      </div>
    </dl>
  );
}
