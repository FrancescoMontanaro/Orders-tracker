'use client';

import * as React from 'react';
import { api } from '@/lib/api-client';
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
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';

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

/** Minimal order shape we fetch for inline status editing */
type DayOrder = {
  id: number;
  customer_id: number;
  status: 'created' | 'delivered';
};

type OrdersByCustomer = Record<number, DayOrder[]>;

/**
 * DayOrdersDialog
 * - Shows the list of orders for a given ISO date.
 * - Lets the user create a new order for that date via parent callback.
 * - Mobile-friendly: cards, compact typography, scrollable content.
 * - ADDED: Inline status change per order (PATCH /orders/:id) without altering existing layout.
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

  // Day orders for inline status editing
  const [ordersByCustomer, setOrdersByCustomer] = React.useState<OrdersByCustomer>({});
  const [updatingId, setUpdatingId] = React.useState<number | null>(null);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // Helper to normalize list responses from API
  function extractRows(payload: any): any[] {
    if (!payload) return [];
    // Try common shapes: {data:{rows}}, {rows}, {data:[]}, []
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.rows)) return payload.rows;
    if (Array.isArray(payload?.data?.rows)) return payload.data.rows;
    return [];
  }

  // Load minimal orders for that specific date using the provided API contract
  React.useEffect(() => {
    let ignore = false;
    async function load() {
      if (!open || !dateISO) return;
      setErrorMsg(null);
      try {
        // POST /api/orders/list?page=1&size=...&delivery_date_after=ISO&delivery_date_before=ISO
        const res = await api.post(
          '/orders/list',
          // Body can contain filters/sort – we keep it empty to fetch all for the day
          { filters: {}, sort: [] },
          {
            params: {
              page: 1,
              size: 1000, // large enough to cover a single day's orders
              delivery_date_after: dateISO,
              delivery_date_before: dateISO,
            },
            headers: { 'Content-Type': 'application/json' },
          }
        );

        const raw = (res.data as any) ?? {};
        const list = extractRows(raw);

        const grouped: OrdersByCustomer = {};
        for (const o of list) {
          const id = Number(o?.id);
          const cid = Number(o?.customer_id);
          const st = (o?.status ?? 'created') as 'created' | 'delivered';
          if (!Number.isFinite(id) || !Number.isFinite(cid)) continue;
          if (!grouped[cid]) grouped[cid] = [];
          grouped[cid].push({ id, customer_id: cid, status: st });
        }
        if (!ignore) setOrdersByCustomer(grouped);
      } catch (e: any) {
        const detail =
          e?.response?.data?.detail ??
          e?.response?.data?.message ??
          e?.message ??
          'Errore sconosciuto';
        if (!ignore) setErrorMsg(`Impossibile caricare gli ordini del giorno: ${String(detail)}`);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [open, dateISO]);

  // Patch order status with optimistic UI
  async function changeStatus(orderId: number, next: 'created' | 'delivered') {
    setErrorMsg(null);
    setUpdatingId(orderId);

    // Optimistic update
    setOrdersByCustomer((prev) => {
      const copy: OrdersByCustomer = {};
      for (const [cid, arr] of Object.entries(prev)) {
        copy[Number(cid)] = arr.map((o) => (o.id === orderId ? { ...o, status: next } : o));
      }
      return copy;
    });

    try {
      await api.patch(`/orders/${orderId}`, { status: next });
    } catch (e: any) {
      // Rollback on error
      setOrdersByCustomer((prev) => {
        const copy: OrdersByCustomer = {};
        for (const [cid, arr] of Object.entries(prev)) {
          copy[Number(cid)] = arr.map((o) =>
            o.id === orderId ? { ...o, status: o.status === 'created' ? 'delivered' : 'created' } : o
          );
        }
        return copy;
      });
      const detail =
        e?.response?.data?.detail ??
        e?.response?.data?.message ??
        e?.message ??
        'Errore sconosciuto';
      setErrorMsg(`Aggiornamento stato non riuscito: ${String(detail)}`);
    } finally {
      setUpdatingId(null);
    }
  }

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

        {/* Optional non-blocking error */}
        {errorMsg && (
          <div className="mb-2 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300">
            {errorMsg}
          </div>
        )}

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
          {customerGroups.map((g) => {
            const orders = ordersByCustomer[g.customer_id] ?? [];
            return (
              <div key={g.customer_id} className="rounded-md border p-2">
                <div className="mb-1 flex items-center justify-between">
                  <div className="text-sm font-medium">
                    <StatusDot delivered={g.delivered} />
                    <span>{g.customer_name}</span>
                  </div>

                  {/* Inline status controls (only if we fetched orders for this customer) */}
                  {orders.length > 0 && (
                    <div className="flex flex-col items-end gap-1">
                      {orders.length === 1 ? (
                        <Select
                          value={orders[0].status}
                          disabled={updatingId === orders[0].id}
                          onValueChange={(v: 'created' | 'delivered') =>
                            changeStatus(orders[0].id, v)
                          }
                        >
                          <SelectTrigger
                            className={cn(
                              'h-8 w-[160px] justify-start text-xs',
                              orders[0].status === 'delivered'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                : 'bg-amber-50 text-amber-700 border-amber-300'
                            )}
                            aria-label="Cambia stato"
                          >
                            <SelectValue placeholder="Stato" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="created">Da consegnare</SelectItem>
                            <SelectItem value="delivered">Consegnato</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="flex flex-col items-end gap-1">
                          {orders.map((o) => (
                            <div key={o.id} className="flex items-center gap-2">
                              <span className="text-[10px] text-muted-foreground">#{o.id}</span>
                              <Select
                                value={o.status}
                                disabled={updatingId === o.id}
                                onValueChange={(v: 'created' | 'delivered') =>
                                  changeStatus(o.id, v)
                                }
                              >
                                <SelectTrigger
                                  className={cn(
                                    'h-7 w-[140px] justify-start text-[11px]',
                                    o.status === 'delivered'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                      : 'bg-amber-50 text-amber-700 border-amber-300'
                                  )}
                                  aria-label={`Cambia stato ordine #${o.id}`}
                                >
                                  <SelectValue placeholder="Stato" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="created">Da consegnare</SelectItem>
                                  <SelectItem value="delivered">Consegnato</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
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
            );
          })}
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