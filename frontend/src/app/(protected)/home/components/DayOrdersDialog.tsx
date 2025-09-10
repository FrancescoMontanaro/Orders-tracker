'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { fmtDate } from '../utils/date';
import { euro } from '../utils/currency';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';

/** Local type to keep this file standalone and portable */
export type DayOrdersGrouped = Array<{
  customer_id: number;
  customer_name: string;
  delivered: boolean;
  /** Monetary total for this order as returned by the API */
  total_amount: number;
  items: Array<{ product_id: number; product_name: string; quantity: number; unit: string }>;
}>;

/** Small colored dot for delivered/pending status */
function StatusDot({ delivered }: { delivered: boolean }) {
  return (
    <span
      className={cn(
        'inline-block h-2.5 w-2.5 rounded-full mr-1 align-middle',
        delivered ? 'bg-emerald-500' : 'bg-amber-500'
      )}
      aria-hidden="true"
    />
  );
}

/**
 * DayOrdersDialog
 * - Shows the list of orders for a given ISO date.
 * - Header and counters are fixed; only the orders list is scrollable.
 * - Displays per-order total and a fixed grand total for the day.
 */
export default function DayOrdersDialog({
  open,
  onOpenChange,
  dateISO,
  customerGroups,
  onNewOrder,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  dateISO: string | undefined;
  customerGroups: DayOrdersGrouped;
  onNewOrder: () => void;
}) {
  if (!dateISO) return null;

  // Delivered / Pending counters
  const deliveredCount = customerGroups.filter((g) => g.delivered).length;
  const pendingCount = customerGroups.length - deliveredCount;

  // Per-order total comes straight from the API
  const orderTotal = (g: DayOrdersGrouped[number]) => Number(g.total_amount ?? 0);

  // Grand total of the day is the sum of all order totals
  const grandTotal = customerGroups.reduce((acc, g) => acc + orderTotal(g), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="
          w-[calc(100vw-2rem)] sm:w-[34rem] md:w-[40rem]
          max-h-[85vh] flex flex-col
        "
      >
        {/* Header (fixed) */}
        <DialogHeader className="shrink-0">
          <DialogTitle>Ordini del {fmtDate(dateISO)}</DialogTitle>
        </DialogHeader>

        {/* Counters summary (fixed) */}
        <div className="mb-2 flex items-center gap-2 text-xs shrink-0">
          {deliveredCount > 0 && (
            <Badge
              variant="outline"
              className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
            >
              Consegnati: {deliveredCount}
            </Badge>
          )}
          {pendingCount > 0 && (
            <Badge
              variant="outline"
              className="border-amber-500/40 text-amber-600 dark:text-amber-400"
            >
              Da consegnare: {pendingCount}
            </Badge>
          )}
          {deliveredCount === 0 && pendingCount === 0 && (
            <span className="text-muted-foreground">Nessun ordine per questa data.</span>
          )}
        </div>

        {/* Scrollable orders list */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {customerGroups.map((g) => {
            const total = orderTotal(g);
            return (
              <div key={g.customer_id} className="rounded-md border p-2">
                {/* Header of the card */}
                <div className="mb-1 flex items-center justify-between">
                  <div className="text-sm font-medium">
                    <StatusDot delivered={g.delivered} />
                    <span>{g.customer_name}</span>
                  </div>
                </div>

                {/* Items */}
                <ul className="text-xs text-muted-foreground leading-snug list-disc pl-5">
                  {g.items.map((it, idx) => (
                    <li key={idx} className="break-words">
                      {it.product_name} × {it.quantity}
                      {it.unit ? ` ${it.unit}` : ''}
                    </li>
                  ))}
                </ul>

                {/* Per-order monetary total (from API) */}
                <div className="mt-3 border-t border-muted/40 pt-2 flex justify-end">
                  <div className="inline-flex items-baseline gap-2 text-sm">
                    <span className="text-muted-foreground">Totale ordine</span>
                    <span className="font-semibold tabular-nums">{euro(total)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Grand total (fixed, outside the scrollable area) */}
        <div className="mt-3 border-t pt-3 shrink-0">
          <div className="flex items-center justify-end">
            <div className="inline-flex items-baseline gap-2 text-sm">
              <span className="text-muted-foreground">Totale complessivo</span>
              <span className="font-semibold tabular-nums">{euro(grandTotal)}</span>
            </div>
          </div>
        </div>

        {/* Footer (fixed) */}
        <DialogFooter className="mt-3 flex flex-row flex-wrap items-center justify-end gap-2 shrink-0">
          <DialogClose asChild>
            <Button variant="outline">Chiudi</Button>
          </DialogClose>
          {/* Opens AddOrderDialog in the parent with the same date */}
          <Button onClick={onNewOrder}>+ Nuovo ordine</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}