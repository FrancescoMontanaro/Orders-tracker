'use client';

import * as React from 'react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DatePicker } from '@/components/ui/date-picker';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import type { SuccessResponse, DailySummaryDay } from '../types/dailySummary';

// ---- Local helpers -----------------------------------------------------------

// Delivery status helpers
const isDelivered = (status?: string) => String(status).toLowerCase() === 'delivered';
const statusLabel = (status?: string) => (status === 'delivered' ? 'Consegnato' : 'Da consegnare');
const statusVariant = (status?: string): 'default' | 'secondary' =>
  (isDelivered(status) ? 'default' : 'secondary');

// Number helpers
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const todayISO = () => new Date().toISOString().slice(0, 10);

// Type for the "group by customer" view
type CustomerGroup = {
  customer_id: number;
  customer_name: string;
  delivered: boolean;
  items: Array<{ product_name: string; quantity: number; unit?: string }>;
};

// ---- Component ---------------------------------------------------------------

export default function DailySummaryCard() {
  const [date, setDate] = React.useState<string>(todayISO());
  const [loading, setLoading] = React.useState(false);
  const [data, setData] = React.useState<DailySummaryDay[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // Toggle: product grouping (default) vs customer grouping
  const [groupByCustomer, setGroupByCustomer] = React.useState(false);

  // Fetch data for the selected date
  async function load(currentDate: string) {
    setLoading(true);
    setError(null);
    try {
      // Always use the date passed in, so we never read a stale state
      const body = { start_date: currentDate, end_date: currentDate };
      const res = await api.post<SuccessResponse<DailySummaryDay[]>>('/widgets/daily-summary', body);
      setData(res.data.data || []);
    } catch {
      setError('Impossibile caricare il riepilogo giornaliero');
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  // Auto-load on mount and whenever `date` changes
  React.useEffect(() => {
    load(date);
  }, [date]);

  // Compute global progress (delivered rows over total customer rows)
  const progress = React.useMemo(() => {
    const day = data?.[0];
    const products = day?.products ?? [];
    const allCustomers = products.flatMap((p: any) => p.customers ?? []);
    const total = allCustomers.length;
    const done = allCustomers.filter((c: any) => isDelivered(c.order_status)).length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return { done, total, pct };
  }, [data]);

  // Build customer groups from the API shape (typed Map avoids `never[]`)
  const customerGroups = React.useMemo<CustomerGroup[]>(() => {
    const day = data?.[0];
    if (!day) return [];

    // Strongly typed Map so `items` is never inferred as `never[]`
    const map = new Map<number, {
      customer_id: number;
      customer_name: string;
      items: Array<{ product_name: string; quantity: number; unit?: string }>;
      deliveredCount: number;
      totalCount: number;
    }>();

    for (const p of (day.products || [])) {
      const customers = (p as any).customers || [];
      for (const c of customers) {
        const id = Number(c.customer_id);
        const existing =
          map.get(id) ||
          {
            customer_id: id,
            customer_name: c.customer_name,
            items: [] as Array<{ product_name: string; quantity: number; unit?: string }>, // explicit type
            deliveredCount: 0,
            totalCount: 0,
          };

        // Push item with product info for this customer
        existing.items.push({
          product_name: p.product_name,
          quantity: Number(c.quantity || 0),
          unit: (p as any).product_unit ?? undefined,
        });

        // Track delivered counts across this customer's orders for the day
        existing.totalCount += 1;
        if (isDelivered(c.order_status)) existing.deliveredCount += 1;

        map.set(id, existing);
      }
    }

    return Array.from(map.values()).map((e) => ({
      customer_id: e.customer_id,
      customer_name: e.customer_name,
      delivered: e.totalCount > 0 && e.deliveredCount === e.totalCount,
      items: e.items,
    }));
  }, [data]);

  // Convenience flags
  const hasProducts = !!(data && data.length > 0 && data[0]?.products?.length > 0);

  return (
    <Card>
      {/* Header: title and date controls */}
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 min-w-0 max-w-full overflow-hidden">
        <CardTitle className="text-lg">Riepilogo consegne del giorno</CardTitle>

        {/* Date controls: single column on mobile, 1fr + auto on sm+ */}
        <div className="grid w-full sm:w-auto max-w-full grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] items-stretch gap-2 min-w-0">
          <DatePicker
            value={date}
            onChange={setDate}               // Selecting a date triggers load via the effect
            className="sm:w-52"
            placeholder="Seleziona data"
          />
          <Button
            variant="outline"
            onClick={() => setDate(todayISO())} // Setting today triggers load via the effect
            className="w-full sm:w-auto justify-center"
          >
            Oggi
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Progress + Switch row.
           - Mobile: stacked, switch on a new line aligned left.
           - sm+: one line, progress left, switch right. */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between items-stretch gap-3">
          {/* Left: progress (or skeleton/placeholder) */}
          {loading ? (
            <Skeleton className="h-4 w-full sm:w-1/2 lg:w-1/3" />
          ) : hasProducts ? (
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
            // Keep an empty placeholder to preserve layout height
            <div className="w-full sm:w-1/2 lg:w-1/3" />
          )}

          {/* Right: grouping switch
             - Mobile: full width, left-aligned (new line).
             - sm+: auto width, right-aligned (same line as progress). */}
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

        {/* Content states */}
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-5/6" />
          </div>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : !hasProducts ? (
          <p className="text-sm text-muted-foreground">
            Nessun prodotto da preparare per la data selezionata.
          </p>
        ) : (
          <>
            {groupByCustomer ? (
              // ---- Customer grouping view (alternative rendering) -------------------
              <div className="space-y-6">
                {customerGroups.map((g) => (
                  <div key={g.customer_id} className="rounded-md border">
                    {/* Customer header: two lines on mobile, row on larger screens */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3">
                      <div className="font-medium break-words">
                        <b>{g.customer_name}</b>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Stato:&nbsp;
                        <Badge className="whitespace-nowrap" variant={g.delivered ? 'default' : 'secondary'}>
                          {g.delivered ? 'Consegnato' : 'Da consegnare'}
                        </Badge>
                      </div>
                    </div>

                    <Separator />

                    {/* Items list for this customer */}
                    <div className="px-4 py-3">
                      {g.items.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nessun prodotto.</p>
                      ) : (
                        <ul className="space-y-2">
                          {g.items.map((it, idx) => (
                            <li
                              key={idx}
                              className="grid grid-cols-[1fr_auto] items-center gap-2 py-1 border-b last:border-none"
                            >
                              <span className="truncate">{it.product_name}</span>
                              <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap">
                                {it.quantity} {it.unit}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              // ---- Original product grouping view (unchanged) ----------------------
              <div className="space-y-6">
                {(data[0]?.products || []).map((p) => {
                  const remaining = round2(
                    (p.customers || []).reduce(
                      (acc, c: any) => acc + (!isDelivered(c.order_status) ? Number(c.quantity || 0) : 0),
                      0
                    )
                  );

                  return (
                    <div key={p.product_id} className="rounded-md border">
                      {/* Product header: two lines on mobile, row on larger screens */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3">
                        <div className="font-medium break-words">
                          <b>{p.product_name}</b>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Da consegnare:&nbsp;
                          <span className="font-semibold whitespace-nowrap">
                            {remaining} / {p.total_qty} {p.product_unit}
                          </span>
                        </div>
                      </div>

                      <Separator />

                      {/* Customers list */}
                      <div className="px-4 py-3">
                        {p.customers.length === 0 ? (
                          <p className="text-sm text-muted-foreground">Nessun dettaglio cliente.</p>
                        ) : (
                          <ul className="space-y-2">
                            {p.customers.map((c: any, idx: number) => (
                              <li
                                key={`${c.customer_id ?? idx}`}
                                /* On sm+ keep everything on one line (name | status | qty-pill).
                                   On mobile it stacks (name on first row, chips on second). */
                                className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] items-center gap-1 py-2 border-b last:border-none"
                              >
                                {/* Customer name: truncate to keep line clean */}
                                <span className="truncate">{c.customer_name}</span>

                                {/* Status badge: fixed-size element, no wrap */}
                                <div className="flex items-center justify-start sm:justify-end">
                                  <Badge className="whitespace-nowrap" variant={statusVariant(c.order_status)}>
                                    {statusLabel(c.order_status)}
                                  </Badge>
                                </div>

                                {/* Quantity pill: compact, non-wrapping */}
                                <div className="flex items-center justify-start sm:justify-end">
                                  <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap">
                                    {c.quantity} {p.product_unit}
                                  </span>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}