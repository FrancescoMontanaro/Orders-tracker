'use client';

import * as React from 'react';
import { Area, AreaChart, CartesianGrid, XAxis } from 'recharts';
import { api } from '@/lib/api-client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import type { CashflowResponse, Granularity, SuccessResponse } from '../types/cashflow';
import { euro } from '../utils/currency';

// Label formatter for X axis and tooltip (supports YYYY / YYYY-MM / YYYY-MM-DD)
function labelFromISO(iso: string) {
  if (/^\d{4}$/.test(iso)) return iso;
  if (/^\d{4}-\d{2}$/.test(iso)) {
    const [y, m] = iso.split('-').map(Number);
    const d = new Date(y, m - 1, 1);
    return d.toLocaleDateString('it-IT', { month: 'short', year: 'numeric' });
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, dd] = iso.split('-').map(Number);
    const d = new Date(y, m - 1, dd);
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
  }
  return iso;
}

function firstLastDayOfCurrentMonth() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const toISO = (d: Date) => d.toISOString().slice(0, 10);
  return { start: toISO(first), end: toISO(last) };
}

const chartConfig = {
  net: { label: 'Netto', color: 'var(--chart-2)' },
} satisfies ChartConfig;

// Cashflow visualization with range + granularity filters
export default function CashflowCard() {
  const { start, end } = React.useMemo(firstLastDayOfCurrentMonth, []);
  const [dateFrom, setDateFrom] = React.useState<string>(start);
  const [dateTo, setDateTo] = React.useState<string>(end);
  const [gran, setGran] = React.useState<Granularity>('daily');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [series, setSeries] = React.useState<Array<{ label: string; net: number; in: number; out: number }>>([]);
  const [totals, setTotals] = React.useState<{ in: number; out: number; net: number }>({ in: 0, out: 0, net: 0 });

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post<SuccessResponse<CashflowResponse>>(
        '/reports/cashflow',
        { start_date: dateFrom, end_date: dateTo },
        { headers: { 'Content-Type': 'application/json' } }
      );
      const data = (res.data as any)?.data ?? res.data;

      // Aggregate by selected granularity
      const agg: Record<string, { in: number; out: number }> = {};
      const keyOf = (isoDate: string) =>
        gran === 'daily' ? isoDate : gran === 'monthly' ? isoDate.slice(0, 7) : isoDate.slice(0, 4);

      (data.entries ?? []).forEach((e: { date: string; amount: number }) => {
        const k = keyOf(e.date);
        if (!agg[k]) agg[k] = { in: 0, out: 0 };
        agg[k].in += Number(e.amount || 0);
      });

      (data.expenses ?? []).forEach((x: { date: string; amount: number }) => {
        const k = keyOf(x.date);
        if (!agg[k]) agg[k] = { in: 0, out: 0 };
        agg[k].out += Number(x.amount || 0);
      });

      const labels = Object.keys(agg).sort();
      const s = labels.map((k) => ({ label: k, in: agg[k].in, out: agg[k].out, net: agg[k].in - agg[k].out }));

      const totalIn = Number(data.entries_total ?? s.reduce((a, r) => a + r.in, 0));
      const totalOut = Number(data.expenses_total ?? s.reduce((a, r) => a + r.out, 0));
      const totalNet = Number(
        data.net ?? (Number.isFinite(totalIn) && Number.isFinite(totalOut) ? totalIn - totalOut : 0)
      );

      setSeries(s);
      setTotals({ in: totalIn, out: totalOut, net: totalNet });
    } catch (e: any) {
      const detail = e?.response?.data?.detail ?? e?.response?.data?.message ?? e?.message ?? 'Errore sconosciuto';
      setError(`Impossibile caricare il cashflow: ${String(detail)}`);
      setSeries([]);
      setTotals({ in: 0, out: 0, net: 0 });
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, gran]);

  React.useEffect(() => { load(); }, [load]);

  const hasData = series.length > 0 && series.some((r) => r.in || r.out || r.net);
  const netClass = totals.net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400';

  function resetMonth() {
    const d = firstLastDayOfCurrentMonth();
    setDateFrom(d.start);
    setDateTo(d.end);
    setGran('daily');
  }

  return (
    // Card clips any accidental horizontal bleed from children
    <Card className="w-full max-w-full overflow-x-hidden">
      <CardHeader className="space-y-2">
        {/* Header toolbar: wrap on small screens and avoid x-overflow */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between min-w-0 max-w-full">
          <CardTitle className="min-w-0">Cashflow</CardTitle>
          <div className="flex flex-wrap items-center gap-2 min-w-0 max-w-full">
            <Button variant="outline" onClick={resetMonth}>Reimposta mese corrente</Button>
          </div>
        </div>
      </CardHeader>

      {/* Content also prevents horizontal overflow */}
      <CardContent className="space-y-4 min-w-0 max-w-full overflow-x-hidden">
        {/* Controls: responsive grid; fields are shrinkable and x-safe */}
        <div className="grid gap-3 sm:grid-cols-3 min-w-0 max-w-full">
          <div className="grid gap-1 min-w-0">
            <Label>Dal</Label>
            {/* Shrinkable date input to avoid x-overflow on Chrome mobile (also in dark mode) */}
            <DatePicker
              value={dateFrom}
              onChange={setDateFrom}
              className="min-w-0 w-full max-w-full"
              placeholder="Seleziona data"
            />
          </div>
          <div className="grid gap-1 min-w-0">
            <Label>Al</Label>
            <DatePicker
              value={dateTo}
              onChange={setDateTo}
              className="min-w-0 w-full max-w-full"
              placeholder="Seleziona data"
            />
          </div>
          <div className="grid gap-1 min-w-0">
            <Label>Granularità</Label>
            {/* Select trigger is capped to container width */}
            <Select value={gran} onValueChange={(v: Granularity) => setGran(v)}>
              <SelectTrigger className="min-w-0 w-full max-w-full">
                <SelectValue placeholder="Seleziona" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Giornaliera</SelectItem>
                <SelectItem value="monthly">Mensile</SelectItem>
                <SelectItem value="yearly">Annuale</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Totals: stack on mobile, three columns from sm+ */}
        <div className="grid gap-3 sm:grid-cols-3 min-w-0 max-w-full">
          <div className="rounded-lg border p-3">
            <div className="text-sm text-muted-foreground">Entrate</div>
            <div className="text-xl font-semibold tabular-nums">{euro(totals.in)}</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-sm text-muted-foreground">Uscite</div>
            <div className="text-xl font-semibold tabular-nums">{euro(totals.out)}</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-sm text-muted-foreground">Netto</div>
            <div className={['text-xl font-semibold tabular-nums', netClass].join(' ')}>
              {euro(totals.net)}
            </div>
          </div>
        </div>

        {/* Chart: clamp width and confine any overflow to this inner scroller (not the whole card) */}
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-[300px] w-full" />
          </div>
        ) : error ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        ) : hasData ? (
          // The outer div ensures the SVG never forces the card to overflow horizontally.
          <div className="min-w-0 max-w-full overflow-x-auto">
            <ChartContainer config={chartConfig} className="w-full max-w-full min-w-0 aspect-[16/9] sm:aspect-[21/9] lg:aspect-[25/9] overflow-hidden">
              <AreaChart data={series} margin={{ left: 12, right: 12 }}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  interval="preserveStartEnd"
                  minTickGap={32}
                  tickFormatter={labelFromISO}
                />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      indicator="line"
                      labelFormatter={(lab) => labelFromISO(String(lab))}
                      nameKey="Netto"
                    />
                  }
                />
                <Area
                  dataKey="net"
                  name="Netto"
                  type="natural"
                  fill="var(--color-net)"
                  fillOpacity={0.4}
                  stroke="var(--color-net)"
                />
              </AreaChart>
            </ChartContainer>
          </div>
        ) : (
          <div className="rounded-lg border p-6 text-sm text-muted-foreground">
            Nessun dato disponibile per il periodo selezionato.
          </div>
        )}
      </CardContent>
    </Card>
  );
}