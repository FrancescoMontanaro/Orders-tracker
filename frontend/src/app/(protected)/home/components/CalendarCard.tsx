'use client';

import * as React from 'react';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

import { Loader2 } from 'lucide-react';
import AddOrderDialog from './AddOrderDialog';
import DayOrdersDialog, { type DayOrdersGrouped } from './DayOrdersDialog';
import { EditOrderDialog } from '../../orders/components/EditOrderDialog';
import type { Order } from '../../orders/types/order';

import type { DailySummaryDay, SuccessResponse } from '../types/dailySummary';
import {
  addMonths,
  firstDayOfMonth,
  itMonthLabel,
  lastDayOfMonth,
  startOfCalendarGrid,
  toISO,
  isToday,
} from '../utils/date';

/* ------------------------------- Utilities -------------------------------- */

// Keep original delivered check
function isDelivered(status?: string) {
  return String(status).toLowerCase() === 'delivered';
}

// Minimal API types from /orders/list (only fields we need)
type OrderItemRow = {
  product_id: number;
  product_name: string;
  unit?: string | null;
  quantity: number;
  unit_price?: number | null;
};
type OrderRow = {
  id: number;
  customer_id: number;
  customer_name: string;
  delivery_date: string; // YYYY-MM-DD
  status: 'created' | 'delivered';
  note?: string | null;
  items: OrderItemRow[];
};

// Extract list rows from heterogeneous shapes
function extractOrderRows(payload: any): OrderRow[] {
  const items = payload?.data?.items;
  if (Array.isArray(items)) return items as OrderRow[];
  if (Array.isArray(payload?.data)) return payload.data as OrderRow[];
  if (Array.isArray(payload?.rows)) return payload.rows as OrderRow[];
  if (Array.isArray(payload)) return payload as OrderRow[];
  return [];
}

/**
 * Build a DailySummaryDay map (keyed by date ISO) from a flat list of orders.
 * We recreate the same shape used by the calendar (products with customers array).
 */
function buildDailyMapFromOrders(rows: OrderRow[]): Record<string, DailySummaryDay> {
  const byDate: Record<string, DailySummaryDay> = {};

  for (const o of rows) {
    const dateISO = o.delivery_date;
    if (!byDate[dateISO]) {
      byDate[dateISO] = { date: dateISO, products: [] };
    }

    // Index products by product_id inside the date bucket for faster aggregation
    const productIndex: Map<number, number> = new Map();
    const day = byDate[dateISO];

    // Initialize map from existing products to keep push O(1)
    day.products.forEach((p, idx) => productIndex.set(p.product_id, idx));

    for (const it of o.items || []) {
      const pid = Number(it.product_id);
      let pIdx = productIndex.get(pid);

      if (pIdx == null) {
        day.products.push({
          product_id: pid,
          product_name: it.product_name,
          product_unit: (it.unit ?? '') as string,
          total_qty: 0,
          customers: [],
        } as any);
        pIdx = day.products.length - 1;
        productIndex.set(pid, pIdx);
      }

      const p = day.products[pIdx];

      // Increase total quantity for the product in that day
      p.total_qty = Number(p.total_qty || 0) + Number(it.quantity || 0);

      // Append a customer row for this order item (carry unit_price + amount for totals)
      const unitPrice = Number(it.unit_price ?? 0);
      const qty = Number(it.quantity || 0);
      p.customers.push({
        order_id: o.id,
        customer_id: o.customer_id,
        customer_name: o.customer_name,
        quantity: qty,
        order_status: o.status,
        unit_price: unitPrice,
        amount: unitPrice * qty,
        order_note: o.note ?? null,
      } as any);
    }
  }

  return byDate;
}

/** Group a day view by customer → orders[].
 *  Each customer has one sub-entry per order_id.
 */
function groupByCustomer(day?: DailySummaryDay): DayOrdersGrouped {
  if (!day) return [];

  // customer_id → { customer info + map of order_id → order entry }
  const customerMap = new Map<
    number,
    {
      customer_id: number;
      customer_name: string;
      orderMap: Map<
        number,
        {
          order_id: number;
          delivered: boolean;
          total_amount: number;
          note: string | null;
          items: Array<{ product_id: number; product_name: string; quantity: number; unit: string }>;
        }
      >;
    }
  >();

  for (const p of day.products || []) {
    for (const c of p.customers || []) {
      const orderId: number | null = (c as any).order_id ?? null;
      if (orderId == null) continue; // skip rows without an order_id

      // Ensure customer entry exists
      if (!customerMap.has(c.customer_id)) {
        customerMap.set(c.customer_id, {
          customer_id: c.customer_id,
          customer_name: c.customer_name,
          orderMap: new Map(),
        });
      }
      const customer = customerMap.get(c.customer_id)!;

      // Ensure order entry exists
      if (!customer.orderMap.has(orderId)) {
        customer.orderMap.set(orderId, {
          order_id: orderId,
          delivered: isDelivered(c.order_status),
          total_amount: 0,
          note: (c as any).order_note ?? null,
          items: [],
        });
      }
      const order = customer.orderMap.get(orderId)!;

      // Update delivered status (mark as pending if even one item is pending)
      if (!isDelivered(c.order_status)) order.delivered = false;

      order.total_amount += Number((c as any).amount ?? 0);
      order.items.push({
        product_id: p.product_id,
        product_name: p.product_name,
        quantity: Number(c.quantity || 0),
        unit: (p as any).product_unit ?? '',
      });
    }
  }

  return Array.from(customerMap.values())
    .map((c) => {
      const orders = Array.from(c.orderMap.values());
      const allDelivered = orders.length > 0 && orders.every((o) => o.delivered);
      return {
        customer_id: c.customer_id,
        customer_name: c.customer_name,
        delivered: allDelivered,
        orders,
      };
    })
    .sort((a, b) => Number(a.delivered) - Number(b.delivered)); // pending first
}

/* -------------------------------- Component -------------------------------- */

export default function CalendarCard() {
  const [month, setMonth] = React.useState<Date>(firstDayOfMonth(new Date()));
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [days, setDays] = React.useState<Record<string, DailySummaryDay>>({});
  const [addOpen, setAddOpen] = React.useState(false);
  const [selectedDate, setSelectedDate] = React.useState<string | undefined>(undefined);

  // Edit order dialog state
  const [editOrder, setEditOrder] = React.useState<Order | null>(null);
  const [editOpen, setEditOpen] = React.useState(false);

  // Day-orders list dialog state
  const [listOpen, setListOpen] = React.useState(false);

  // Totals for the selected day (computed on click)
  const [totalsByCustomer, setTotalsByCustomer] = React.useState<Array<{ customer_id: number; customer_name: string; total: number }>>([]);
  const [grandTotal, setGrandTotal] = React.useState<number>(0);

  // Scroll containers
  const desktopRef = React.useRef<HTMLDivElement>(null);
  const mobileRef = React.useRef<HTMLDivElement>(null);

  // When true, the next completed load will trigger a scroll to today's cell.
  // Starts as true so the initial page-load auto-scrolls to today.
  const scrollToTodayRef = React.useRef(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Full 6-week grid interval
      const firstMonthDay = firstDayOfMonth(month);
      const gridStart = startOfCalendarGrid(firstMonthDay);
      const gridEnd = new Date(gridStart);
      gridEnd.setDate(gridStart.getDate() + 41); // 6 weeks (42 cells) - 1

      const startISO = toISO(gridStart);
      const endISO = toISO(gridEnd);

      // Fetch all orders in the grid window via /orders/list
      const res = await api.post(
        '/orders/list',
        { filters: {}, sort: [] },
        {
          params: {
            page: 1,
            size: -1, // no pagination
            delivery_date_after: startISO,
            delivery_date_before: endISO,
          },
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const list = extractOrderRows(res.data).map((o) => ({
        ...o,
        status: (o.status as any) === 'delivered' ? 'delivered' : 'created',
        items: (o.items || []).map((it) => ({
          ...it,
          quantity: Number(it.quantity || 0),
        })),
      })) as OrderRow[];

      // Rebuild DailySummaryDay map per date
      const map = buildDailyMapFromOrders(list);
      setDays(map);
    } catch (e: any) {
      const detail =
        e?.response?.data?.detail ??
        e?.response?.data?.message ??
        e?.message ??
        'Errore sconosciuto';
      setError(`Impossibile caricare il calendario: ${String(detail)}`);
      setDays({});
    } finally {
      setLoading(false);
    }
  }, [month]);

  React.useEffect(() => {
    load();
  }, [load]);

  // Build 6-week grid (42 cells)
  const gridCells = React.useMemo(() => {
    const first = firstDayOfMonth(month);
    const gridStart = startOfCalendarGrid(first);
    const cells: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      cells.push(d);
    }
    return cells;
  }, [month]);

  const weekDays = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

  // === NEW: legend counters (delivered / pending across the current grid) ===
  const legend = React.useMemo(() => {
    let delivered = 0;
    let pending = 0;
    for (const d of Object.values(days)) {
      const allOrders = groupByCustomer(d).flatMap((g) => g.orders);
      const dCount = allOrders.filter((o) => o.delivered).length;
      const pCount = allOrders.length - dCount;
      delivered += dCount;
      pending += pCount;
    }
    return { delivered, pending };
  }, [days]);

  // Click opens day-orders list (+ compute totals)
  function onDayClick(date: Date) {
    const iso = toISO(date);
    setSelectedDate(iso);

    // Compute per-customer totals and grand total for that date
    const day = days[iso];
    const groups = groupByCustomer(day);
    const perCustomer = groups.map((g) => ({
      customer_id: g.customer_id,
      customer_name: g.customer_name,
      total: g.orders.reduce((s, o) => s + Number(o.total_amount ?? 0), 0),
    }));
    const grand = perCustomer.reduce((s, r) => s + r.total, 0);
    setTotalsByCustomer(perCustomer);
    setGrandTotal(grand);

    setListOpen(true);
  }

  function gotoPrev() {
    setMonth((m) => addMonths(m, -1));
  }
  function gotoNext() {
    setMonth((m) => addMonths(m, +1));
  }
  function gotoToday() {
    // Mark that we want to scroll to today once the new month's load completes.
    scrollToTodayRef.current = true;
    setMonth(firstDayOfMonth(new Date()));
  }

  // Scroll the visible calendar container so that today's cell is centred.
  const attemptScrollToToday = React.useCallback((): boolean => {
    const containers = [desktopRef.current, mobileRef.current].filter(Boolean) as HTMLElement[];

    for (const root of containers) {
      // Skip containers that are hidden (e.g. desktop grid on mobile via md:hidden)
      if (!root || root.offsetParent === null) continue;

      const el = root.querySelector<HTMLElement>('[data-today="true"]');
      if (!el) continue;

      // scrollIntoView correctly handles nested scroll containers on both
      // desktop (horizontal grid) and mobile (vertical list).
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      return true;
    }

    return false;
  }, []);

  // Scroll to today's cell whenever a load completes AND scrollToTodayRef is set.
  // We wait for two animation frames so the browser has fully painted the new
  // calendar grid before querying element positions via scrollIntoView.
  React.useEffect(() => {
    if (loading) return;
    if (!scrollToTodayRef.current) return;

    let rafId1: number;
    let rafId2: number;

    rafId1 = requestAnimationFrame(() => {
      rafId2 = requestAnimationFrame(() => {
        if (!scrollToTodayRef.current) return;
        const ok = attemptScrollToToday();
        if (ok) scrollToTodayRef.current = false;
      });
    });

    return () => {
      cancelAnimationFrame(rafId1);
      cancelAnimationFrame(rafId2);
    };
  }, [loading, days, attemptScrollToToday]);

  return (
    <>
      <Card>
        <CardHeader className="space-y-3">
          {/* Header */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-lg">Calendario ordini</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={gotoToday} disabled={loading} aria-label="Vai ad oggi">
                Oggi
              </Button>
              <Button variant="outline" onClick={gotoPrev} disabled={loading} aria-label="Mese precedente">
                ‹
              </Button>
              <div className="min-w-[10ch] text-center font-medium sm:min-w-[12ch]">
                {itMonthLabel(month)}
              </div>
              <Button variant="outline" onClick={gotoNext} disabled={loading} aria-label="Mese successivo">
                ›
              </Button>
            </div>
          </div>

          {/* Legend (with global counters) */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
              <span>Da consegnare</span>
              <Badge
                variant="outline"
                className="border-amber-500/40 text-amber-600 dark:text-amber-400"
                title="Totale clienti con consegna ancora da effettuare (nell'intervallo visibile)"
              >
                {legend.pending}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
              <span>Consegnato</span>
              <Badge
                variant="outline"
                className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                title="Totale clienti con ordini consegnati (nell'intervallo visibile)"
              >
                {legend.delivered}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {loading && Object.keys(days).length === 0 ? (
            // First load: show skeleton placeholder
            <div className="space-y-2">
              <Skeleton className="h-5 w-1/4" />
              <Skeleton className="h-[360px] w-full" />
            </div>
          ) : error ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </div>
          ) : (
            // Calendar is rendered; show overlay spinner on subsequent reloads
            <div className="relative">
              {loading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/60 backdrop-blur-[1px]">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              )}
            <>
              {/* Desktop calendar grid */}
              <div ref={desktopRef} className="hidden md:block w-full overflow-x-auto">
                <div className="min-w-[56rem] md:min-w-0">
                  <div className="grid grid-cols-7 text-xs text-muted-foreground">
                    {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map((wd) => (
                      <div key={wd} className="px-2 py-1 text-center">
                        {wd}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-2">
                    {gridCells.map((d) => {
                      const inCurrentMonth = d.getMonth() === month.getMonth();
                      const iso = toISO(d);
                      const grouped = groupByCustomer(days[iso]);
                      const today = isToday(d);
                      const allOrders = grouped.flatMap((g) => g.orders);
                      const deliveredCount = allOrders.filter((o) => o.delivered).length;
                      const pendingCount = allOrders.length - deliveredCount;

                      return (
                        <button
                          key={iso}
                          type="button"
                          onClick={() => onDayClick(d)}
                          data-today={today ? 'true' : undefined}
                          data-iso={iso}
                          className={cn(
                            'group relative min-h-32 rounded-lg border p-2 text-left transition-colors',
                            'hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2',
                            'scroll-mx-8',
                            inCurrentMonth ? 'bg-card' : 'bg-muted/30 text-muted-foreground',
                            today && 'ring-1 ring-inset ring-primary/40 bg-primary/5'
                          )}
                        >
                          <div className="mb-2 flex items-center justify-between">
                            <div
                              className={cn(
                                'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
                                today ? 'bg-primary text-primary-foreground' : 'bg-muted'
                              )}
                              aria-label={today ? 'Oggi' : undefined}
                              title={iso}
                            >
                              {d.getDate()}
                            </div>

                            {(deliveredCount > 0 || pendingCount > 0) && (
                              <div className="flex items-center gap-1">
                                {deliveredCount > 0 && (
                                  <Badge
                                    variant="outline"
                                    className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                                  >
                                    {deliveredCount}
                                  </Badge>
                                )}
                                {pendingCount > 0 && (
                                  <Badge
                                    variant="outline"
                                    className="border-amber-500/40 text-amber-600 dark:text-amber-400"
                                  >
                                    {pendingCount}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>

                          {grouped.length ? (
                            <ul className="space-y-1 text-xs max-h-36 overflow-y-auto pr-1">
                              {grouped.map((g) => {
                                const totalProducts = g.orders.reduce((s, o) => s + o.items.length, 0);
                                return (
                                  <li key={g.customer_id} className="leading-snug">
                                    <span
                                      className={cn(
                                        'inline-block h-2 w-2 rounded-full mr-1 align-middle',
                                        g.delivered ? 'bg-emerald-500' : 'bg-amber-500'
                                      )}
                                    />
                                    <span className="font-medium">{g.customer_name}</span>
                                    <div className="pl-3 text-muted-foreground/70">
                                      {g.orders.length === 1 ? '1 ordine' : `${g.orders.length} ordini`}
                                      {' · '}
                                      {totalProducts === 1 ? '1 prodotto' : `${totalProducts} prodotti`}
                                    </div>
                                  </li>
                                );
                              })}
                            </ul>
                          ) : (
                            <div className="text-xs text-muted-foreground/70">Nessun ordine</div>
                          )}

                          <div className="pointer-events-none absolute inset-x-2 bottom-2 hidden justify-end group-hover:flex">
                            <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                              Vedi / Aggiungi ordini
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Mobile list view */}
              <div ref={mobileRef} className="md:hidden grid grid-cols-1 gap-2" aria-busy={loading}>
                {gridCells.map((d) => {
                  const inCurrentMonth = d.getMonth() === month.getMonth();
                  const iso = toISO(d);
                  const grouped = groupByCustomer(days[iso]);
                  const today = isToday(d);
                  const allOrders = grouped.flatMap((g) => g.orders);
                  const deliveredCount = allOrders.filter((o) => o.delivered).length;
                  const pendingCount = allOrders.length - deliveredCount;

                  return (
                    <button
                      key={iso}
                      type="button"
                      onClick={() => onDayClick(d)}
                      data-today={today ? 'true' : undefined}
                      data-iso={iso}
                      className={cn(
                        'block w-full rounded-lg border p-3 text-left transition-colors',
                        'hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2',
                        inCurrentMonth ? 'bg-card' : 'bg-muted/30 text-muted-foreground',
                        today && 'ring-1 ring-inset ring-primary/40 bg-primary/5'
                      )}
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div
                          className={cn(
                            'inline-flex h-7 px-2 min-w-[2rem] items-center justify-center rounded-full text-xs font-semibold',
                            today ? 'bg-primary text-primary-foreground' : 'bg-muted'
                          )}
                          aria-label={today ? 'Oggi' : undefined}
                          title={iso}
                        >
                          {d.getDate()}{' '}
                          {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'][d.getDay() === 0 ? 6 : d.getDay() - 1]}
                        </div>

                        {(deliveredCount > 0 || pendingCount > 0) && (
                          <div className="flex items-center gap-1 shrink-0">
                            {deliveredCount > 0 && (
                              <Badge
                                variant="outline"
                                className="whitespace-nowrap border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                              >
                                {deliveredCount}
                              </Badge>
                            )}
                            {pendingCount > 0 && (
                              <Badge
                                variant="outline"
                                className="whitespace-nowrap border-amber-500/40 text-amber-600 dark:text-amber-400"
                              >
                                {pendingCount}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>

                      {grouped.length ? (
                        <ul className="space-y-1 text-xs max-h-32 overflow-y-auto pr-1">
                          {grouped.map((g) => {
                            const totalProducts = g.orders.reduce((s, o) => s + o.items.length, 0);
                            return (
                              <li key={g.customer_id} className="leading-snug">
                                <span
                                  className={cn(
                                    'inline-block h-2 w-2 rounded-full mr-1 align-middle',
                                    g.delivered ? 'bg-emerald-500' : 'bg-amber-500'
                                  )}
                                />
                                <span className="font-medium">{g.customer_name}</span>
                                <div className="pl-3 text-muted-foreground/70">
                                  {g.orders.length === 1 ? '1 ordine' : `${g.orders.length} ordini`}
                                  {' · '}
                                  {totalProducts === 1 ? '1 prodotto' : `${totalProducts} prodotti`}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <div className="text-xs text-muted-foreground/70">Nessun ordine</div>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Day orders list dialog (we pass totals so the dialog can show per-order and grand totals) */}
      <DayOrdersDialog
        open={listOpen}
        onOpenChange={setListOpen}
        dateISO={selectedDate}
        customerGroups={selectedDate ? groupByCustomer(days[selectedDate]) : []}
        onNewOrder={() => {
          setAddOpen(true);
        }}
        onEditOrder={(orderId) => {
          setEditOrder({ id: orderId } as Order);
          setEditOpen(true);
        }}
        {...({
          totalsByCustomer,
          grandTotal,
        } as any)}
      />

      {/* Add dialog */}
      <AddOrderDialog
        open={addOpen}
        onOpenChange={(o) => setAddOpen(o)}
        onCreated={() => {
          load();
        }}
        defaultDate={selectedDate}
      />

      {/* Edit order dialog */}
      <EditOrderDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        order={editOrder}
        onSaved={() => {
          setEditOpen(false);
          load();
        }}
        onDeleted={() => {
          setEditOpen(false);
          load();
        }}
        onError={() => {}}
      />
    </>
  );
}
