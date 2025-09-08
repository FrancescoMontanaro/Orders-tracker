'use client';

import * as React from 'react';
import { api } from '@/lib/api-client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { AreaChart, Area, BarChart, Bar, CartesianGrid, XAxis, YAxis, ComposedChart, Line, ResponsiveContainer } from 'recharts';
import type { CashflowResponse, Granularity, SuccessResponse } from '../types/cashflow';
import { euro } from '../utils/currency';

/* ============================================================
 * Helpers
 * ============================================================ */

/** Label formatter for X axis / tooltip (supports YYYY | YYYY-MM | YYYY-MM-DD) */
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

/** Returns date string (YYYY-MM-DD) +/- n days */
function shiftISO(dateISO: string, deltaDays: number) {
  const [y, m, d] = dateISO.split('-').map(Number);
  const date = new Date(y, (m - 1), d);
  date.setDate(date.getDate() + deltaDays);
  return date.toISOString().slice(0, 10);
}

/** Compute number of days between two ISO dates (inclusive) */
function daysInclusive(startISO: string, endISO: string) {
  const a = new Date(startISO + 'T00:00:00Z').getTime();
  const b = new Date(endISO + 'T00:00:00Z').getTime();
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
}

/** Weekday label (it-IT) from ISO date */
function weekdayLabel(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('it-IT', { weekday: 'short' });
}

/* ============================================================
 * Chart configs
 * ============================================================ */

const mainChartConfig = {
  inflow: { label: 'Entrate', color: 'var(--chart-1)' },
  outflow: { label: 'Uscite', color: 'var(--chart-2)' },
  net: { label: 'Netto', color: 'var(--chart-3)' },
} satisfies ChartConfig;

const cumChartConfig = {
  cnet: { label: 'Netto cumulato', color: 'var(--chart-4)' },
} satisfies ChartConfig;

const weekdayConfig = {
  amount: { label: 'Totale (EUR)', color: 'var(--chart-5)' },
} satisfies ChartConfig;

/* ============================================================
 * CashflowCardPro – always-on previous period comparison
 * ============================================================ */

export default function CashflowCardPro() {
  // Defaults to current month
  const { start, end } = React.useMemo(firstLastDayOfCurrentMonth, []);
  const [dateFrom, setDateFrom] = React.useState<string>(start);
  const [dateTo, setDateTo] = React.useState<string>(end);
  const [gran, setGran] = React.useState<Granularity>('daily');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Aggregated series for charts/table (current)
  const [series, setSeries] = React.useState<Array<{ label: string; in: number; out: number; net: number }>>([]);
  const [totals, setTotals] = React.useState<{ in: number; out: number; net: number }>({ in: 0, out: 0, net: 0 });

  // Previous period totals (always computed)
  const [prevTotals, setPrevTotals] = React.useState<{ in: number; out: number; net: number }>({ in: 0, out: 0, net: 0 });

  // Derived analytics
  const [bestIn, setBestIn] = React.useState<{ label: string; value: number } | null>(null);
  const [worstOut, setWorstOut] = React.useState<{ label: string; value: number } | null>(null);
  const [avgNet, setAvgNet] = React.useState<number>(0);
  const [weekdayRows, setWeekdayRows] = React.useState<Array<{ day: string; amount: number }>>([]);

  // ---- data loader (current + previous) ----
  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1) Load current period
      const currentRes = await api.post<SuccessResponse<CashflowResponse>>(
        '/reports/cashflow',
        { start_date: dateFrom, end_date: dateTo },
        { headers: { 'Content-Type': 'application/json' } }
      );
      const current = (currentRes.data as any)?.data ?? currentRes.data;

      // Aggregate by chosen granularity
      const keyOf = (isoDate: string) =>
        gran === 'daily' ? isoDate : gran === 'monthly' ? isoDate.slice(0, 7) : isoDate.slice(0, 4);

      const agg: Record<string, { in: number; out: number }> = {};
      (current.entries ?? []).forEach((e: { date: string; amount: number }) => {
        const k = keyOf(e.date);
        if (!agg[k]) agg[k] = { in: 0, out: 0 };
        agg[k].in += Number(e.amount || 0);
      });
      (current.expenses ?? []).forEach((x: { date: string; amount: number }) => {
        const k = keyOf(x.date);
        if (!agg[k]) agg[k] = { in: 0, out: 0 };
        agg[k].out += Number(x.amount || 0);
      });

      const labels = Object.keys(agg).sort();
      const s = labels.map((k) => ({ label: k, in: agg[k].in, out: agg[k].out, net: agg[k].in - agg[k].out }));

      // Totals (fallback to sum if API doesn't return them)
      const totalIn = Number(current.entries_total ?? s.reduce((a, r) => a + r.in, 0));
      const totalOut = Number(current.expenses_total ?? s.reduce((a, r) => a + r.out, 0));
      const totalNet = Number(current.net ?? (Number.isFinite(totalIn) && Number.isFinite(totalOut) ? totalIn - totalOut : 0));

      // 2) Previous period with same length, immediately preceding
      const len = daysInclusive(dateFrom, dateTo);
      const prevEnd = shiftISO(dateFrom, -1);
      const prevStart = shiftISO(prevEnd, -(len - 1));

      const prevRes = await api.post<SuccessResponse<CashflowResponse>>(
        '/reports/cashflow',
        { start_date: prevStart, end_date: prevEnd },
        { headers: { 'Content-Type': 'application/json' } }
      );
      const prevData = (prevRes.data as any)?.data ?? prevRes.data;
      const pin = Number(prevData.entries_total ?? 0);
      const pout = Number(prevData.expenses_total ?? 0);
      const pnet = Number(prevData.net ?? (pin - pout));

      // 3) Analytics (current series)
      const bestInRow = s.reduce((best, r) => (r.in > (best?.value ?? -Infinity) ? { label: r.label, value: r.in } : best), null as any);
      const worstOutRow = s.reduce((worst, r) => (r.out > (worst?.value ?? -Infinity) ? { label: r.label, value: r.out } : worst), null as any);
      const avg = s.length ? s.reduce((a, r) => a + r.net, 0) / s.length : 0;

      // Weekday distribution (daily granularity)
      const weekdayAgg: Record<string, number> = {};
      if (gran === 'daily') {
        (current.entries ?? []).forEach((e: { date: string; amount: number }) => {
          const wd = weekdayLabel(e.date);
          weekdayAgg[wd] = (weekdayAgg[wd] ?? 0) + Number(e.amount || 0);
        });
        (current.expenses ?? []).forEach((x: { date: string; amount: number }) => {
          const wd = weekdayLabel(x.date);
          weekdayAgg[wd] = (weekdayAgg[wd] ?? 0) - Number(x.amount || 0);
        });
      }
      const weekdayOrder = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'];
      const wrows = weekdayOrder.map((w) => ({ day: w, amount: Number(weekdayAgg[w] ?? 0) }));

      // Set state
      setSeries(s);
      setTotals({ in: totalIn, out: totalOut, net: totalNet });
      setPrevTotals({ in: pin, out: pout, net: pnet });
      setBestIn(bestInRow);
      setWorstOut(worstOutRow);
      setAvgNet(avg);
      setWeekdayRows(wrows);
    } catch (e: any) {
      const detail = e?.response?.data?.detail ?? e?.response?.data?.message ?? e?.message ?? 'Errore sconosciuto';
      setError(`Impossibile caricare il cashflow: ${String(detail)}`);
      setSeries([]);
      setTotals({ in: 0, out: 0, net: 0 });
      setPrevTotals({ in: 0, out: 0, net: 0 });
      setBestIn(null);
      setWorstOut(null);
      setAvgNet(0);
      setWeekdayRows([]);
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

  // Cumulative series for the secondary chart
  const cumulative = React.useMemo(() => {
    let acc = 0;
    return series.map((r) => {
      acc += r.net;
      return { label: r.label, cnet: acc };
    });
  }, [series]);

  // Bars container width (enables horizontal scroll on dense periods)
  const BAR_PX = 44;
  const MIN_INNER = Math.max(series.length * BAR_PX + 64, 0);
  const barOuterRef = React.useRef<HTMLDivElement | null>(null);
  const [outerW, setOuterW] = React.useState(0);
  React.useEffect(() => {
    if (!barOuterRef.current) return;
    const ro = new ResizeObserver((entries) => setOuterW(entries[0]?.contentRect?.width ?? 0));
    ro.observe(barOuterRef.current);
    return () => ro.disconnect();
  }, []);

  // Delta helpers (current vs previous)
  const delta = (curr: number, prev: number) => {
    if (!Number.isFinite(prev)) return { text: '—', cls: '' };
    const d = curr - prev;
    const sign = d > 0 ? '+' : d < 0 ? '−' : '';
    const pct = prev !== 0 ? (d / Math.abs(prev)) * 100 : 0;
    const pctStr = prev !== 0 ? `${sign}${Math.abs(pct).toFixed(1)}%` : '—';
    const cls = d >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400';
    return { text: `${sign}${euro(Math.abs(d))} (${pctStr})`, cls };
  };

  const dIn = delta(totals.in, prevTotals.in);
  const dOut = delta(totals.out, prevTotals.out);
  const dNet = delta(totals.net, prevTotals.net);

  return (
    <Card className="w-full max-w-full overflow-x-hidden">
      {/* ===== Header ===== */}
      <CardHeader className="space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between min-w-0 max-w-full">
          <CardTitle className="min-w-0">Cashflow</CardTitle>
          <div className="flex flex-wrap items-center gap-2 min-w-0 max-w-full">
            <Button variant="outline" onClick={resetMonth}>Reimposta mese corrente</Button>
          </div>
        </div>
      </CardHeader>

      {/* ===== Controls + KPIs ===== */}
      <CardContent className="space-y-5 min-w-0 max-w-full overflow-x-hidden">
        {/* Filters */}
        <div className="grid gap-3 sm:grid-cols-3 min-w-0 max-w-full">
          <div className="grid gap-1 min-w-0">
            <Label>Dal</Label>
            <DatePicker value={dateFrom} onChange={setDateFrom} className="min-w-0 w-full" placeholder="Seleziona data" />
          </div>
          <div className="grid gap-1 min-w-0">
            <Label>Al</Label>
            <DatePicker value={dateTo} onChange={setDateTo} className="min-w-0 w-full" placeholder="Seleziona data" />
          </div>
          <div className="grid gap-1 min-w-0">
            <Label>Granularità</Label>
            <Select value={gran} onValueChange={(v: Granularity) => setGran(v)}>
              <SelectTrigger className="min-w-0 w-full"><SelectValue placeholder="Seleziona" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Giornaliera</SelectItem>
                <SelectItem value="monthly">Mensile</SelectItem>
                <SelectItem value="yearly">Annuale</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* KPIs grid (with always-on deltas) */}
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {/* Entrate */}
            <div className="rounded-lg border p-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Entrate</div>
              <div className="mt-1 text-xl font-semibold tabular-nums">{euro(totals.in)}</div>
              <div className={`text-xs mt-1 ${dIn.cls}`}>{dIn.text}</div>
            </div>
            {/* Uscite */}
            <div className="rounded-lg border p-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Uscite</div>
              <div className="mt-1 text-xl font-semibold tabular-nums">{euro(totals.out)}</div>
              <div className={`text-xs mt-1 ${dOut.cls}`}>{dOut.text}</div>
            </div>
            {/* Netto */}
            <div className="rounded-lg border p-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Netto</div>
              <div className={['mt-1 text-xl font-semibold tabular-nums', netClass].join(' ')}>
                {euro(totals.net)}
              </div>
              <div className={`text-xs mt-1 ${dNet.cls}`}>{dNet.text}</div>
            </div>
            {/* Miglior periodo (Entrate) */}
            <div className="rounded-lg border p-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Miglior periodo (Entrate)</div>
              <div className="mt-1 text-sm tabular-nums">
                {bestIn ? `${labelFromISO(bestIn.label)} • ${euro(bestIn.value)}` : '—'}
              </div>
            </div>
            {/* Peggior periodo (Uscite) */}
            <div className="rounded-lg border p-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Peggior periodo (Uscite)</div>
              <div className="mt-1 text-sm tabular-nums">
                {worstOut ? `${labelFromISO(worstOut.label)} • ${euro(worstOut.value)}` : '—'}
              </div>
            </div>
          </div>
        )}

        {/* ===== Main chart: In/Out (stacked) + Net line ===== */}
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
          <div className="space-y-3">
            <div className="text-sm font-medium">Andamento Entrate/Uscite e Netto</div>
            <div ref={barOuterRef} className="w-full overflow-x-auto rounded-md border">
              <div className="h-[320px]" style={{ minWidth: Math.max(MIN_INNER, outerW || 0) }}>
                <ChartContainer config={mainChartConfig} className="h-full w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={series}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis
                        dataKey="label"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        minTickGap={24}
                        tickFormatter={labelFromISO}
                      />
                      <YAxis tickLine={false} axisLine={false} width={60} />
                      <ChartTooltip
                        cursor={false}
                        content={
                          <ChartTooltipContent
                            indicator="dashed"
                            labelFormatter={(lab) => labelFromISO(String(lab))}
                          />
                        }
                      />
                      <Bar dataKey="in" name={mainChartConfig.inflow.label} fill="var(--color-inflow)" radius={[4,4,0,0]} />
                      <Bar dataKey="out" name={mainChartConfig.outflow.label} fill="var(--color-outflow)" radius={[4,4,0,0]} />
                      <Line type="monotone" dataKey="net" name={mainChartConfig.net.label} stroke="var(--color-net)" strokeWidth={2} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border p-6 text-sm text-muted-foreground">
            Nessun dato disponibile per il periodo selezionato.
          </div>
        )}

        {/* ===== Secondary chart: Cumulative Net ===== */}
        {hasData && (
          <div className="space-y-3">
            <div className="text-sm font-medium">Netto cumulato</div>
            <div className="w-full overflow-x-auto rounded-md border">
              <div className="h-[280px]" style={{ minWidth: Math.max(MIN_INNER, outerW || 0) }}>
                <ChartContainer config={cumChartConfig} className="h-full w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={cumulative} margin={{ left: 8, right: 8 }}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis
                        dataKey="label"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        minTickGap={24}
                        tickFormatter={labelFromISO}
                      />
                      <ChartTooltip
                        cursor={false}
                        content={
                          <ChartTooltipContent
                            indicator="line"
                            labelFormatter={(lab) => labelFromISO(String(lab))}
                          />
                        }
                      />
                      <Area
                        dataKey="cnet"
                        name={cumChartConfig.cnet.label}
                        type="natural"
                        fill="var(--color-cnet)"
                        fillOpacity={0.25}
                        stroke="var(--color-cnet)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </div>
            </div>
          </div>
        )}

        {/* ===== Weekday distribution (only for daily) ===== */}
        {gran === 'daily' && hasData && (
          <div className="space-y-3">
            <div className="text-sm font-medium">Distribuzione per giorno della settimana (Entrate − Uscite)</div>
            <div className="w-full overflow-x-auto rounded-md border">
              <div className="h-[240px] min-w-[520px]">
                <ChartContainer config={weekdayConfig} className="h-full w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weekdayRows}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} />
                      <YAxis tickLine={false} axisLine={false} width={60} />
                      <ChartTooltip
                        cursor={false}
                        content={
                          <ChartTooltipContent
                            indicator="dashed"
                            labelFormatter={(lab) => `Giorno: ${String(lab)}`}
                          />
                        }
                      />
                      <Bar dataKey="amount" name={weekdayConfig.amount.label} fill="var(--color-amount)" radius={4} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </div>
            </div>
          </div>
        )}

        {/* ===== Detail (cards on mobile, table on desktop) ===== */}
        {hasData && (
          <div className="space-y-3">
            <div className="text-sm font-medium">Dettaglio periodo</div>
            {/* Mobile cards */}
            <div className="md:hidden space-y-2">
              {series.map((r) => (
                <div key={r.label} className="rounded-md border p-3">
                  <div className="font-medium">{labelFromISO(r.label)}</div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                    <div className="text-muted-foreground">Entrate</div>
                    <div className="text-right tabular-nums">{euro(r.in)}</div>
                    <div className="text-muted-foreground">Uscite</div>
                    <div className="text-right tabular-nums">{euro(r.out)}</div>
                    <div className="text-muted-foreground">Netto</div>
                    <div className={['text-right tabular-nums', r.net >= 0 ? 'text-emerald-600' : 'text-red-600'].join(' ')}>
                      {euro(r.net)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {/* Desktop table */}
            <div className="hidden md:block w-full overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Periodo</th>
                    <th className="px-3 py-2 text-right font-medium">Entrate</th>
                    <th className="px-3 py-2 text-right font-medium">Uscite</th>
                    <th className="px-3 py-2 text-right font-medium">Netto</th>
                  </tr>
                </thead>
                <tbody>
                  {series.map((r) => (
                    <tr key={r.label} className="border-t">
                      <td className="px-3 py-2">{labelFromISO(r.label)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{euro(r.in)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{euro(r.out)}</td>
                      <td className={['px-3 py-2 text-right tabular-nums', r.net >= 0 ? 'text-emerald-600' : 'text-red-600'].join(' ')}>
                        {euro(r.net)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}