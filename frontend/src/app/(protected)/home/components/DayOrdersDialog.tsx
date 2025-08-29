'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { fmtDate } from '../utils/date';
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
 * - Lets the user create a new order for that date via parent callback.
 * - Mobile-friendly: cards, compact typography, scrollable content.
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

  const deliveredCount = customerGroups.filter((g) => g.delivered).length;
  const pendingCount = customerGroups.length - deliveredCount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="
          w-[calc(100vw-2rem)] sm:w-[34rem] md:w-[40rem]
          max-h-[85vh] overflow-y-auto overflow-x-hidden
        "
      >
        <DialogHeader>
          {/* Keep title short and clear; ISO has no ambiguity */}
          <DialogTitle>Ordini del {fmtDate(dateISO)}</DialogTitle>
        </DialogHeader>

        {/* Counters summary */}
        <div className="mb-2 flex items-center gap-2 text-xs">
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

        {/* Orders, grouped by customer (compact cards) */}
        <div className="space-y-2">
          {customerGroups.map((g) => (
            <div key={g.customer_id} className="rounded-md border p-2">
              <div className="mb-1 flex items-center justify-between">
                <div className="text-sm font-medium">
                  <StatusDot delivered={g.delivered} />
                  <span>{g.customer_name}</span>
                </div>
              </div>

              <ul className="text-xs text-muted-foreground leading-snug list-disc pl-5">
                {g.items.map((it, idx) => (
                  <li key={idx} className="break-words">
                    {it.product_name} × {it.quantity}
                    {it.unit ? ` ${it.unit}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <DialogFooter className="mt-3 flex flex-row flex-wrap items-center justify-end gap-2">
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