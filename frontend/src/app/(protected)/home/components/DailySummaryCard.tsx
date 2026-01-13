'use client';

import * as React from 'react';
import { api } from '@/lib/api-client';
import { formatUnit } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DatePicker } from '@/components/ui/date-picker';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { euro } from '../utils/currency';

/* --------------------------------- Helpers --------------------------------- */

// Delivery status helpers
const isDelivered = (status?: string) => String(status).toLowerCase() === 'delivered';
const statusLabel = (status?: string) => (isDelivered(status) ? 'Consegnato' : 'Da consegnare');
const statusVariant = (status?: string): 'default' | 'secondary' =>
  (isDelivered(status) ? 'default' : 'secondary');

// Number helpers
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const todayISO = () => new Date().toISOString().slice(0, 10);

// API response types (minimal shape we rely on)
type OrderItemRow = {
  id: number;
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
  delivery_date: string;
  status: 'created' | 'delivered';
  total_amount?: number | null;
  applied_discount?: number | null;
  items: OrderItemRow[];
};

// Product-group view data
type ProductCustomerRow = {
  order_id: number;
  customer_id: number;
  customer_name: string;
  order_status: 'created' | 'delivered';
  quantity: number;
};

type ProductGroup = {
  product_id: number;
  product_name: string;
  unit?: string;
  total_qty: number;       // sum across all orders
  remaining_qty: number;   // sum of qty for orders still "created"
  customers: ProductCustomerRow[]; // flat rows: one per order/customer that includes the product
};

// Customer-group view data
type CustomerOrderRow = {
  id: number;
  status: 'created' | 'delivered';
  total_amount: number; // from API (fallback to computed if missing)
  items: Array<{ product_name: string; quantity: number; unit?: string; unit_price: number; subtotal: number }>;
};

type CustomerGroup = {
  customer_id: number;
  customer_name: string;
  deliveredAll: boolean;     // true if all the customer's orders of the day are delivered
  total_amount_sum: number;  // sum of totals of all orders for the day
  orders: CustomerOrderRow[]; // each row is an order
};

/** Safely extract the "items array" from heterogeneous API shapes */
function extractOrderRows(payload: any): OrderRow[] {
  // Expected: { status, data: { total, items: [...] } }
  const items = payload?.data?.items;
  if (Array.isArray(items)) return items as OrderRow[];

  // Fallbacks for other potential shapes used in the app
  if (Array.isArray(payload?.data)) return payload.data as OrderRow[];
  if (Array.isArray(payload?.rows)) return payload.rows as OrderRow[];
  if (Array.isArray(payload)) return payload as OrderRow[];
  return [];
}

/** Compute order total from items if API total_amount is absent */
function fallbackTotalAmount(o: OrderRow): number {
  const sum = (o.items || []).reduce((acc, it) => {
    const q = Number(it.quantity || 0);
    const p = Number(it.unit_price ?? 0);
    return acc + q * p;
  }, 0);
  const discount = Number(o.applied_discount ?? 0);
  return round2(sum * (1 - (discount || 0) / 100));
}

/* -------------------------------- Component -------------------------------- */

export default function DailySummaryCard() {
  const [date, setDate] = React.useState<string>(todayISO());
  const [loading, setLoading] = React.useState(false);
  const [orders, setOrders] = React.useState<OrderRow[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  // Toggle: product grouping (default=false)
  const [groupByCustomer, setGroupByCustomer] = React.useState(false);

  // Inline status update state
  const [updatingId, setUpdatingId] = React.useState<number | null>(null);
  const [inlineError, setInlineError] = React.useState<string | null>(null);

  // Fetch all orders for the selected date via /orders/list
  async function load(currentDate: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post(
        '/orders/list',
        { filters: {}, sort: [] },
        {
          params: {
            page: 1,
            size: -1, // No pagination is applied when -1 is set
            delivery_date_after: currentDate,
            delivery_date_before: currentDate,
          },
          headers: { 'Content-Type': 'application/json' },
        }
      );
      const list = extractOrderRows(res.data);
      setOrders(
        list.map((o) => ({
          ...o,
          status: (o.status as any) === 'delivered' ? 'delivered' : 'created',
          items: (o.items || []).map((it) => ({
            ...it,
            unit: (it.unit ?? undefined) as any,
            quantity: Number(it.quantity || 0),
          })),
        }))
      );
    } catch (e: any) {
      const detail =
        e?.response?.data?.detail ??
        e?.response?.data?.message ??
        e?.message ??
        'Errore sconosciuto';
      setError(`Impossibile caricare gli ordini del giorno: ${String(detail)}`);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }

  // Auto-load on mount and whenever `date` changes
  React.useEffect(() => {
    load(date);
  }, [date]);

  /* --------------------------- Derived visual models --------------------------- */

  // Progress: delivered orders over total orders
  const progress = React.useMemo(() => {
    const total = orders.length;
    const done = orders.filter((o) => isDelivered(o.status)).length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return { done, total, pct };
  }, [orders]);

  // Product groups, computed from flat orders
  const productGroups = React.useMemo<ProductGroup[]>(() => {
    const map = new Map<number, ProductGroup>();

    for (const o of orders) {
      for (const it of o.items || []) {
        const key = Number(it.product_id);
        const entry = map.get(key) || {
          product_id: key,
          product_name: it.product_name,
          unit: (it.unit ?? undefined) as string | undefined,
          total_qty: 0,
          remaining_qty: 0,
          customers: [] as ProductCustomerRow[],
        };

        entry.total_qty += Number(it.quantity || 0);
        if (!isDelivered(o.status)) {
          entry.remaining_qty += Number(it.quantity || 0);
        }

        entry.customers.push({
          order_id: o.id,
          customer_id: o.customer_id,
          customer_name: o.customer_name,
          order_status: o.status,
          quantity: Number(it.quantity || 0),
        });

        map.set(key, entry);
      }
    }

    // Sort: pending first (by remaining_qty desc), then by name
    return Array.from(map.values()).sort((a, b) => {
      if (a.remaining_qty !== b.remaining_qty) return b.remaining_qty - a.remaining_qty;
      return a.product_name.localeCompare(b.product_name, 'it');
    });
  }, [orders]);

  // Customer groups with multiple order rows per customer (NO re-sorting on status change)
  const customerGroups = React.useMemo<CustomerGroup[]>(() => {
    const map = new Map<number, CustomerGroup>();

    for (const o of orders) {
      const key = Number(o.customer_id);
      const total_amount = o.total_amount ?? fallbackTotalAmount(o);

      const entry = map.get(key) || {
        customer_id: key,
        customer_name: o.customer_name,
        deliveredAll: true,        // will AND with each order's status
        total_amount_sum: 0,
        orders: [] as CustomerOrderRow[],
      };

      entry.orders.push({
        id: o.id,
        status: o.status,
        total_amount: Number(total_amount || 0),
        items: (o.items || []).map((it) => {
          const qty = Number(it.quantity || 0);
          const price = Number(it.unit_price ?? 0);
          return {
            product_name: it.product_name,
            quantity: qty,
            unit: (it.unit ?? undefined) as any,
            unit_price: price,
            subtotal: round2(qty * price),
          };
        }),
      });

      entry.total_amount_sum += Number(total_amount || 0);
      if (!isDelivered(o.status)) entry.deliveredAll = false;

      map.set(key, entry);
    }

    // IMPORTANT: keep insertion order to avoid reordering on status changes
    return Array.from(map.values());
  }, [orders]);

  const hasOrders = orders.length > 0;

  /* ----------------------------- Inline updates ------------------------------ */

  /** Optimistic PATCH of a single order's status (keeps visual order stable) */
  async function changeStatus(orderId: number, next: 'created' | 'delivered') {
    setInlineError(null);
    setUpdatingId(orderId);

    // Optimistic update (no re-sorting anywhere)
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: next } : o))
    );

    try {
      await api.patch(`/orders/${orderId}`, { status: next });
    } catch (e: any) {
      // Rollback on error
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId ? { ...o, status: o.status === 'created' ? 'delivered' : 'created' } : o
        )
      );
      const detail =
        e?.response?.data?.detail ??
        e?.response?.data?.message ??
        e?.message ??
        'Errore sconosciuto';
      setInlineError(`Aggiornamento stato non riuscito: ${String(detail)}`);
    } finally {
      setUpdatingId(null);
    }
  }

  /* --------------------------------- Render --------------------------------- */

  return (
    <Card>
      {/* Header: title and date controls */}
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 min-w-0 max-w-full overflow-hidden">
        <CardTitle className="text-lg">Riepilogo consegne del giorno</CardTitle>

        {/* Date controls: single column on mobile, 1fr + auto on sm+ */}
        <div className="grid w-full sm:w-auto max-w-full grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] items-stretch gap-2 min-w-0">
          <DatePicker
            value={date}
            onChange={setDate}
            className="sm:w-52"
            placeholder="Seleziona data"
          />
          <Button
            variant="outline"
            onClick={() => setDate(todayISO())}
            className="w-full sm:w-auto justify-center"
          >
            Oggi
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Progress + Switch row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between items-stretch gap-3">
          {/* Progress */}
          {loading ? (
            <Skeleton className="h-4 w-full sm:w-1/2 lg:w-1/3" />
          ) : hasOrders ? (
            <div className="space-y-1 w-full sm:w-1/2 lg:w-1/3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Completamento consegne</span>
                <span className="tabular-nums">
                  {progress.done}/{progress.total} ({progress.pct}%)
                </span>
              </div>
              <Progress value={progress.pct} />
            </div>
          ) : (
            <div className="w-full sm:w-1/2 lg:w-1/3" />
          )}

          {/* Grouping switch */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-start sm:justify-end">
            <Switch
              id="group-by-customer"
              checked={groupByCustomer}
              onCheckedChange={setGroupByCustomer}
            />
            <label
              htmlFor="group-by-customer"
              className="text-sm text-muted-foreground cursor-pointer select-none"
            >
              Raggruppa per cliente
            </label>
          </div>
        </div>

        {/* Optional non-blocking inline error (status patch) */}
        {inlineError && (
          <div className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300">
            {inlineError}
          </div>
        )}

        {/* Content states */}
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-5/6" />
          </div>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : !hasOrders ? (
          <p className="text-sm text-muted-foreground">
            Nessun ordine per la data selezionata.
          </p>
        ) : (
          <>
            {groupByCustomer ? (
              /* ------------------------ Customer grouping view ------------------------ */
              <div className="space-y-6">
                {/* Totale complessivo giornata */}
                <div className="flex items-center justify-end px-1 text-sm text-muted-foreground">
                  <span>Totale complessivo giornata:&nbsp;</span>
                  <span className="font-semibold">
                    {euro(customerGroups.reduce((acc, g) => acc + Number(g.total_amount_sum || 0), 0))}
                  </span>
                </div>

                {customerGroups.map((g) => (
                  <div key={g.customer_id} className="rounded-md border">
                    {/* Customer header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3">
                      <div className="font-medium break-words">
                        <b>{g.customer_name}</b>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <div className="whitespace-nowrap">
                          Totale cliente:&nbsp;<span className="font-semibold">{euro(g.total_amount_sum)}</span>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Orders list for this customer (one row per order) */}
                    <div className="px-4 py-3">
                      <ul className="space-y-2">
                        {g.orders.map((ord) => (
                          <li key={ord.id} className="py-3 border-b last:border-none space-y-2">
                            {/* Top row: Order ID (left) and Total (right) on the same baseline */}
                            <div className="flex items-center justify-between text-sm">
                              <div className="text-xs text-muted-foreground">Ordine #{ord.id}</div>
                              <div className="font-semibold whitespace-nowrap">Totale: {euro(ord.total_amount)}</div>
                            </div>

                            {/* Body: mobile stacks, desktop shows two columns (items | status) */}
                            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
                              {/* Left: items list */}
                              <div>
                                {ord.items.length === 0 ? (
                                  <p className="text-sm text-muted-foreground">Nessun prodotto.</p>
                                ) : (
                                  <ul className="divide-y divide-border">
                                    {ord.items.map((it, idx) => (
                                      <li key={idx} className="py-2 first:pt-0 last:pb-0">
                                        <div className="flex flex-col gap-1">
                                          {/* Product name row */}
                                          <div className="flex items-center justify-between gap-2">
                                            <span className="font-medium text-sm truncate">{it.product_name}</span>
                                            <span className="text-sm font-semibold text-primary whitespace-nowrap">
                                              {euro(it.subtotal)}
                                            </span>
                                          </div>
                                          {/* Details row: quantity x price */}
                                          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                                            <span className="inline-flex items-center gap-1">
                                              <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 font-medium">
                                                {it.quantity} {formatUnit(it.unit)}
                                              </span>
                                              <span className="hidden sm:inline">×</span>
                                              <span className="hidden sm:inline">{euro(it.unit_price)}/unità</span>
                                            </span>
                                            <span className="sm:hidden">
                                              {euro(it.unit_price)} × {it.quantity}
                                            </span>
                                          </div>
                                        </div>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>

                              {/* Right: status select (full width on mobile, right-aligned on desktop) */}
                              <div className="flex items-start sm:items-center justify-start sm:justify-end">
                                <Select
                                  value={ord.status}
                                  disabled={updatingId === ord.id}
                                  onValueChange={(v: 'created' | 'delivered') => changeStatus(ord.id, v)}
                                >
                                  <SelectTrigger
                                    className={[
                                      'h-8 px-2 text-xs w-auto',
                                      ord.status === 'delivered'
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                        : 'bg-amber-50 text-amber-700 border-amber-300',
                                    ].join(' ')}
                                    aria-label={`Cambia stato ordine #${ord.id}`}
                                  >
                                    <SelectValue placeholder="Stato" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="created">Da consegnare</SelectItem>
                                    <SelectItem value="delivered">Consegnato</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* ------------------------- Product grouping view ------------------------ */
              <div className="space-y-6">
                {productGroups.map((p) => (
                  <div key={p.product_id} className="rounded-md border">
                    {/* Product header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3">
                      <div className="font-medium break-words">
                        <b>{p.product_name}</b>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Da consegnare:&nbsp;
                        <span className="font-semibold whitespace-nowrap">
                          {round2(p.remaining_qty)} / {round2(p.total_qty)} {formatUnit(p.unit)}
                        </span>
                      </div>
                    </div>

                    <Separator />

                    {/* Customers list (one row for each order including this product) */}
                    <div className="px-4 py-3">
                      {p.customers.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nessun dettaglio cliente.</p>
                      ) : (
                        <ul className="space-y-2">
                          {p.customers.map((c) => (
                            <li
                              key={`${c.order_id}-${c.customer_id}`}
                              className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] items-center gap-1 py-2 border-b last:border-none"
                            >
                              {/* Customer name */}
                              <span className="truncate">{c.customer_name}</span>

                              {/* Status badge */}
                              <div className="flex items-center justify-start sm:justify-end">
                                <Badge className="whitespace-nowrap" variant={statusVariant(c.order_status)}>
                                  {statusLabel(c.order_status)}
                                </Badge>
                              </div>

                              {/* Quantity pill */}
                              <div className="flex items-center justify-start sm:justify-end">
                                <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap">
                                  {c.quantity} {formatUnit(p.unit)}
                                </span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}