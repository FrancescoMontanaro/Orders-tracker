'use client';

import * as React from 'react';
import { Pencil } from 'lucide-react';
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

/** A single order belonging to a customer */
export type CustomerOrder = {
  order_id: number;
  delivered: boolean;
  total_amount: number;
  note?: string | null;
  items: Array<{ product_id: number; product_name: string; quantity: number; unit: string }>;
};

/** One row per customer; each customer may have multiple orders */
export type DayOrdersGrouped = Array<{
  customer_id: number;
  customer_name: string;
  /** True only when ALL orders of this customer are delivered */
  delivered: boolean;
  orders: CustomerOrder[];
}>;

/** Small colored dot for delivered/pending status */
function StatusDot({ delivered }: { delivered: boolean }) {
  return (
    <span
      className={cn(
        'inline-block h-2.5 w-2.5 rounded-full shrink-0',
        delivered ? 'bg-emerald-500' : 'bg-amber-500'
      )}
      aria-hidden="true"
    />
  );
}

/**
 * DayOrdersDialog
 * - Shows orders grouped by customer for a given ISO date.
 * - Each customer card expands into sub-cards (one per order).
 * - Each sub-card has: status dot, edit button, items list, note, order total.
 */
export default function DayOrdersDialog({
  open,
  onOpenChange,
  dateISO,
  customerGroups,
  onNewOrder,
  onEditOrder,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  dateISO: string | undefined;
  customerGroups: DayOrdersGrouped;
  onNewOrder: () => void;
  onEditOrder?: (orderId: number) => void;
}) {
  if (!dateISO) return null;

  // Count individual orders delivered vs pending
  const allOrders = customerGroups.flatMap((g) => g.orders);
  const deliveredCount = allOrders.filter((o) => o.delivered).length;
  const pendingCount = allOrders.length - deliveredCount;

  // Grand total across all orders of all customers
  const grandTotal = customerGroups.reduce(
    (acc, g) => acc + g.orders.reduce((a, o) => a + Number(o.total_amount ?? 0), 0),
    0
  );

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
            <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
              Consegnati: {deliveredCount}
            </Badge>
          )}
          {pendingCount > 0 && (
            <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400">
              Da consegnare: {pendingCount}
            </Badge>
          )}
          {deliveredCount === 0 && pendingCount === 0 && (
            <span className="text-muted-foreground">Nessun ordine per questa data.</span>
          )}
        </div>

        {/* Scrollable list — one card per customer */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {customerGroups.map((g) => (
            <div key={g.customer_id} className="rounded-lg border bg-card">
              {/* ── Customer header ── */}
              <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/40 rounded-t-lg">
                <StatusDot delivered={g.delivered} />
                <span className="font-semibold text-sm">{g.customer_name}</span>
                <Badge variant="outline" className="ml-auto text-xs">
                  {g.orders.length === 1 ? '1 ordine' : `${g.orders.length} ordini`}
                </Badge>
              </div>

              {/* ── Order sub-cards ── */}
              <div className="divide-y">
                {g.orders.map((ord, idx) => (
                  <div key={ord.order_id} className="px-3 py-2">
                    {/* Sub-header: order label + edit button */}
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <StatusDot delivered={ord.delivered} />
                        <span className="font-medium text-foreground">Ordine #{ord.order_id}</span>
                      </div>
                      {onEditOrder && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-muted-foreground hover:text-foreground"
                          onClick={() => onEditOrder(ord.order_id)}
                          title="Modifica ordine"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>

                    {/* Items */}
                    <ul className="text-xs text-muted-foreground leading-snug list-disc pl-4 space-y-0.5">
                      {ord.items.map((it, i) => (
                        <li key={i} className="break-words">
                          {it.product_name} × {it.quantity}
                          {it.unit ? ` ${it.unit}` : ''}
                        </li>
                      ))}
                    </ul>

                    {/* Note */}
                    {ord.note && (
                      <p className="mt-1.5 text-xs text-muted-foreground italic whitespace-pre-wrap break-words">
                        📝 {ord.note}
                      </p>
                    )}

                    {/* Order total */}
                    <div className="mt-2 flex justify-end">
                      <span className="text-xs text-muted-foreground">
                        Totale:{' '}
                        <span className="font-semibold text-foreground tabular-nums">
                          {euro(Number(ord.total_amount ?? 0))}
                        </span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Grand total (fixed) */}
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
          <Button onClick={onNewOrder}>+ Nuovo ordine</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}