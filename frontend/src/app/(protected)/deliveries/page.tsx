'use client';

import * as React from 'react';
import { api } from '@/lib/api-client';
import { formatUnit } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DatePicker } from '@/components/ui/date-picker';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Boxes, ClipboardList } from 'lucide-react';
import type { SuccessResponse } from '@/types/api';
import type { DailyDeliveries } from './types/delivery';

/* --------------------------------- Helpers --------------------------------- */

// Delivery status helpers
const isDelivered = (status?: string) => String(status).toLowerCase() === 'delivered';
const statusLabel = (status?: string) => (isDelivered(status) ? 'Consegnato' : 'Da preparare');
const statusVariant = (status?: string): 'default' | 'secondary' =>
  isDelivered(status) ? 'default' : 'secondary';

// Number helpers
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const todayISO = () => new Date().toISOString().slice(0, 10);

/* -------------------------------- Component -------------------------------- */

/**
 * DeliveriesPage
 * Daily deliveries summary for employees: the products to prepare, grouped by
 * order. Quantities only — no prices and no customer data.
 */
export default function DeliveriesPage() {
  const [date, setDate] = React.useState<string>(todayISO());
  const [loading, setLoading] = React.useState(false);
  const [summary, setSummary] = React.useState<DailyDeliveries | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // Fetch the summary of the selected day
  const load = React.useCallback(async (currentDate: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<SuccessResponse<DailyDeliveries>>('/deliveries/daily', {
        params: { delivery_date: currentDate },
      });
      setSummary(res.data?.data ?? null);
    } catch (e: any) {
      const detail =
        e?.response?.data?.detail ??
        e?.response?.data?.message ??
        e?.message ??
        'Errore sconosciuto';
      setError(`Impossibile caricare le consegne del giorno: ${String(detail)}`);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-load on mount and whenever `date` changes
  React.useEffect(() => {
    load(date);
  }, [date, load]);

  const orders = summary?.orders ?? [];
  const totals = summary?.totals ?? [];
  const hasOrders = orders.length > 0;

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

      <CardContent className="space-y-6">
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
            Nessuna consegna per la data selezionata.
          </p>
        ) : (
          <Tabs defaultValue="totals" className="w-full">
            {/* Two clearly separated views over the same day */}
            <TabsList className="grid w-full grid-cols-2 gap-1 rounded-full border bg-muted/40 p-1 !h-auto sm:mx-auto sm:w-fit">
              <TabsTrigger
                value="totals"
                className="gap-2 rounded-full px-4 py-2 data-[state=active]:bg-background data-[state=active]:shadow"
              >
                <Boxes className="h-4 w-4" aria-hidden />
                Da preparare
                <span className="text-xs text-muted-foreground">({totals.length})</span>
              </TabsTrigger>
              <TabsTrigger
                value="orders"
                className="gap-2 rounded-full px-4 py-2 data-[state=active]:bg-background data-[state=active]:shadow"
              >
                <ClipboardList className="h-4 w-4" aria-hidden />
                Per ordine
                <span className="text-xs text-muted-foreground">({orders.length})</span>
              </TabsTrigger>
            </TabsList>

            {/* Totals: what to prepare in total, across every order of the day */}
            <TabsContent value="totals" className="mt-6 space-y-3">
              <p className="text-sm text-muted-foreground">
                Quantità totali da preparare per la giornata.
              </p>

              <div className="rounded-md border px-4 py-3">
                <ul className="divide-y divide-border">
                  {totals.map((t) => (
                    <li
                      key={t.product_id}
                      className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
                    >
                      <span className="font-medium break-words">{t.product_name}</span>
                      <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-sm font-semibold whitespace-nowrap">
                        {round2(t.quantity)} {formatUnit(t.unit)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </TabsContent>

            {/* Per-order detail: how to split the products across the orders */}
            <TabsContent value="orders" className="mt-6 space-y-3">
              <p className="text-sm text-muted-foreground">
                Come suddividere i prodotti tra i singoli ordini.
              </p>

              <div className="space-y-4">
                {orders.map((o) => (
                  <div key={o.order_id} className="rounded-md border">
                    {/* Order header: id and status only */}
                    <div className="flex items-center justify-between gap-2 px-4 py-3">
                      <div className="font-medium">Ordine #{o.order_id}</div>
                      <Badge className="whitespace-nowrap" variant={statusVariant(o.status)}>
                        {statusLabel(o.status)}
                      </Badge>
                    </div>

                    <Separator />

                    {/* Products of the order */}
                    <div className="px-4 py-3">
                      {o.items.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nessun prodotto.</p>
                      ) : (
                        <ul className="divide-y divide-border">
                          {o.items.map((it) => (
                            <li
                              key={`${o.order_id}-${it.product_id}`}
                              className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
                            >
                              <span className="text-sm break-words">{it.product_name}</span>
                              <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap">
                                {round2(it.quantity)} {formatUnit(it.unit)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
