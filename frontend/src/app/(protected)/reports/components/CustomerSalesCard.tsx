'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api-client';
import { cn, formatUnit } from '@/lib/utils';
import type { SuccessResponse } from '@/types/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { DatePicker } from '@/components/ui/date-picker';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { ResponsiveContainer, BarChart, Bar, XAxis, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { euro } from '../utils/currency';
import type { CustomerSales } from '../types/customerSales';
import { addDays, toIsoDate, fmtDate } from '../utils/date';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { SearchCombobox } from './SearchCombobox';
import type { Option } from '../hooks/useRemoteSearch';
import { FilterToggleButton } from '@/components/ui/filter-toggle-button';

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function useIsSmallScreen() {
  const [isSmall, setIsSmall] = React.useState(false);
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(max-width: 768px)');
    const onChange = () => setIsSmall(mql.matches);
    onChange();
    mql.addEventListener?.('change', onChange);
    return () => mql.removeEventListener?.('change', onChange);
  }, []);
  return isSmall;
}

function truncateLabel(s: string, max = 14) {
  if (!s) return s;
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

const customerChartConfig = {
  revenue: { label: 'Ricavi (EUR)', color: 'var(--chart-1)' },
  total_qty: { label: 'Quantità (unità)', color: 'var(--chart-2)' },
} satisfies ChartConfig;

type TWMode = 'none' | 'top5' | 'top10' | 'worst5' | 'worst10';

function applyTopWorst<T extends { revenue: number }>(rows: T[], mode: TWMode): T[] {
  if (mode === 'none') return rows;
  const n = mode.includes('10') ? 10 : 5;
  const sorted = [...rows].sort((a, b) => b.revenue - a.revenue); // desc by revenue
  if (mode.startsWith('top')) return sorted.slice(0, n);
  // worst
  return sorted.slice(-n);
}

/**
 * CustomerSalesCard (responsive + Top/Worst single-select)
 */
export function CustomerSalesCard() {
  const isSmall = useIsSmallScreen();

  const sp = useSearchParams();
  const customerIdFromUrl = Number(sp.get('customer_id') || 0) || 0;

  const today = new Date();
  const defaultEnd = toIsoDate(today);
  const defaultStart = toIsoDate(addDays(today, -30));

  const [start, setStart] = React.useState<string>(defaultStart);
  const [end, setEnd] = React.useState<string>(defaultEnd);
  const [customer, setCustomer] = React.useState<Option | null>(
    customerIdFromUrl ? { id: customerIdFromUrl, name: `#${customerIdFromUrl}` } : null
  );

  const [data, setData] = React.useState<CustomerSales | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [topWorst, setTopWorst] = React.useState<TWMode>('none');
  const [mobileFiltersOpen, setMobileFiltersOpen] = React.useState(false);

  const debouncedCustomer = useDebouncedValue(customer, 250);
  const debouncedStart = useDebouncedValue(start, 250);
  const debouncedEnd = useDebouncedValue(end, 250);

  const fetchReport = React.useCallback(async () => {
    if (!debouncedCustomer?.id) {
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const payload = {
        start_date: debouncedStart,
        end_date: debouncedEnd,
        customer_id: Number(debouncedCustomer.id),
      };
      const res = await api.post<SuccessResponse<CustomerSales>>('/reports/customer-sales', payload, {
        headers: { 'Content-Type': 'application/json' },
      });
      const d = (res.data as any).data ?? res.data;
      setData(d);

      if (customer && customer.name.startsWith('#')) {
        setCustomer({ id: d.customer_id, name: d.customer_name });
      }
    } catch (e: any) {
      const detail = e?.response?.data?.detail ?? e?.response?.data?.message ?? e?.message ?? 'Errore sconosciuto';
      setError(String(detail));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [debouncedCustomer, debouncedStart, debouncedEnd]); // eslint-disable-line

  React.useEffect(() => { fetchReport(); }, [fetchReport]);

  const perProd = data?.per_product ?? [];
  const filteredPerProd = applyTopWorst(perProd, topWorst);
  const hasData = !!data && filteredPerProd.length > 0;

  const PIE_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];

  // Horizontal scroll width for bars (avoid shrinking bars when many categories)
  const BAR_WIDTH = 48;   // category width incl. gap
  const MIN_INNER = Math.max(filteredPerProd.length * BAR_WIDTH + 60, 0); // + some padding

  // --- measure bar container to enable horizontal scroll only when needed ---
  const barOuterRef = React.useRef<HTMLDivElement | null>(null);
  const [barOuterWidth, setBarOuterWidth] = React.useState(0);
  React.useEffect(() => {
    if (!barOuterRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width ?? 0;
      setBarOuterWidth(w);
    });
    ro.observe(barOuterRef.current);
    return () => ro.disconnect();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vendite per Cliente</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 overflow-x-hidden">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <FilterToggleButton
            open={mobileFiltersOpen}
            onToggle={() => setMobileFiltersOpen((prev) => !prev)}
            className="w-full sm:w-auto"
          />
        </div>

        {/* Filters */}
        <div
          className={cn(
            'hidden md:grid gap-3 md:grid-cols-5 min-w-0',
            mobileFiltersOpen ? '' : 'md:hidden',
          )}
        >
          <div className="grid gap-1 min-w-0">
            <Label>Da</Label>
            <DatePicker value={start} onChange={setStart} placeholder="Data da" className="min-w-0 w-full" />
          </div>
          <div className="grid gap-1 min-w-0">
            <Label>A</Label>
            <DatePicker value={end} onChange={setEnd} placeholder="Data a" className="min-w-0 w-full" />
          </div>
          <div className="md:col-span-2 min-w-0">
            <div className="grid gap-1 min-w-0">
              <Label>Cliente</Label>
              <SearchCombobox
                value={customer}
                onChange={setCustomer}
                endpoint="/customers/list"
                placeholder="Seleziona cliente…"
                emptyText="Nessun cliente"
              />
            </div>
          </div>
          {/* Top/Worst single-select */}
          <div className="min-w-0">
            <div className="grid gap-1">
              <Label>Mostra</Label>
              <Select value={topWorst} onValueChange={(v: TWMode) => setTopWorst(v)}>
                <SelectTrigger className="min-w-0 w-full">
                  <SelectValue placeholder="Nessun filtro" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nessun filtro</SelectItem>
                  <SelectItem value="top5">Migliori 5 (ricavi)</SelectItem>
                  <SelectItem value="top10">Migliori 10 (ricavi)</SelectItem>
                  <SelectItem value="worst5">Peggiori 5 (ricavi)</SelectItem>
                  <SelectItem value="worst10">Peggiori 10 (ricavi)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Mobile filters */}
        <div className={cn('md:hidden space-y-3', mobileFiltersOpen ? 'block' : 'hidden')}>
          <div className="grid gap-1 min-w-0">
            <Label>Da</Label>
            <DatePicker value={start} onChange={setStart} placeholder="Data da" className="min-w-0 w-full" />
          </div>
          <div className="grid gap-1 min-w-0">
            <Label>A</Label>
            <DatePicker value={end} onChange={setEnd} placeholder="Data a" className="min-w-0 w-full" />
          </div>
          <div className="grid gap-1 min-w-0">
            <Label>Cliente</Label>
            <SearchCombobox
              value={customer}
              onChange={setCustomer}
              endpoint="/customers/list"
              placeholder="Seleziona cliente…"
              emptyText="Nessun cliente"
            />
          </div>
          <div className="grid gap-1 min-w-0">
            <Label>Mostra</Label>
            <Select value={topWorst} onValueChange={(v: TWMode) => setTopWorst(v)}>
              <SelectTrigger className="min-w-0 w-full">
                <SelectValue placeholder="Nessun filtro" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nessun filtro</SelectItem>
                <SelectItem value="top5">Migliori 5 (ricavi)</SelectItem>
                <SelectItem value="top10">Migliori 10 (ricavi)</SelectItem>
                <SelectItem value="worst5">Peggiori 5 (ricavi)</SelectItem>
                <SelectItem value="worst10">Peggiori 10 (ricavi)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* KPI + Charts */}
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : error ? (
          <div className="text-sm text-red-600">{error}</div>
        ) : !data ? (
          <div className="text-sm text-muted-foreground">Seleziona un cliente per vedere il report.</div>
        ) : (
          <>
            {/* Header KPI */}
            <div className="rounded-lg border p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Cliente</span>
                <span className="font-medium">{data.customer_name} (#{data.customer_id})</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Periodo</span>
                <span className="tabular-nums">{fmtDate(start)} → {fmtDate(end)}</span>
              </div>
              <div className="mt-1 border-t pt-2 flex items-center justify-between font-medium">
                <span>Ricavi totali</span>
                <span className="tabular-nums">{euro(data.total_revenue)}</span>
              </div>
            </div>

            {!hasData ? (
              <div className="text-sm text-muted-foreground">Nessun dato di dettaglio per i filtri selezionati.</div>
            ) : (
              <>
                {/* Pie: revenue distribution per product */}
                <div className="h-[300px] sm:h-[320px] w-full">
                  <ChartContainer
                    config={{ revenue: { label: 'Ricavi (EUR)', color: 'var(--chart-1)' } }}
                    className="h-full w-full"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <ChartTooltip
                          content={
                            <ChartTooltipContent
                              labelFormatter={(label, payload) => {
                                const row = (payload?.[0]?.payload || {}) as (typeof filteredPerProd)[number];
                                return row.unit ? `${row.product_name} (${formatUnit(row.unit)})` : row.product_name;
                              }}
                            />
                          }
                        />
                        <ChartLegend content={<ChartLegendContent />} />
                        <Pie
                          data={filteredPerProd}
                          dataKey="revenue"
                          nameKey="product_name"
                          outerRadius={isSmall ? 90 : 110}
                          label={isSmall ? false : (entry: any) =>
                            `${entry.product_name}${entry.unit ? ` (${formatUnit(entry.unit)})` : ''}`
                          }
                        >
                          {filteredPerProd.map((_, idx) => (
                            <Cell key={`slice-${idx}`} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </div>

                {/* Bars: horizontal scroll only if MIN_INNER > container width */}
                <div ref={barOuterRef} className="w-full overflow-x-auto rounded-md border">
                  <div
                    className="h-[300px] sm:h-[320px]"
                    // If MIN_INNER <= container width, minWidth === container width -> no scroll & 100% width
                    style={{ minWidth: Math.max(MIN_INNER, barOuterWidth || 0) }}
                  >
                    <ChartContainer config={customerChartConfig} className="h-full w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart accessibilityLayer data={filteredPerProd}>
                          <CartesianGrid vertical={false} strokeDasharray="3 3" />
                          <XAxis
                            dataKey="product_name"
                            tickLine={false}
                            tickMargin={10}
                            axisLine={false}
                            tickFormatter={(name: string, idx: number) => {
                              const base = filteredPerProd[idx]?.unit ? `${name} (${formatUnit(filteredPerProd[idx].unit)})` : name;
                              return isSmall ? truncateLabel(base) : base;
                            }}
                          />
                          <ChartTooltip
                            cursor={false}
                            content={
                              <ChartTooltipContent
                                indicator="dashed"
                                labelFormatter={(_, payload) => {
                                  const row = (payload?.[0]?.payload || {}) as (typeof filteredPerProd)[number];
                                  return row.unit ? `${row.product_name} (${formatUnit(row.unit)})` : row.product_name;
                                }}
                              />
                            }
                          />
                          <Bar dataKey="revenue" name={customerChartConfig.revenue.label} fill="var(--color-revenue)" radius={4} />
                          <Bar dataKey="total_qty" name={customerChartConfig.total_qty.label} fill="var(--color-total_qty)" radius={4} />
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                  </div>
                </div>
              </>
            )}

            {/* Detail: table on desktop, cards on mobile */}
            {hasData && (
              isSmall ? (
                <div className="space-y-2">
                  {filteredPerProd.map((p) => (
                    <div key={p.product_id} className="rounded-md border p-3">
                      <div className="font-medium break-words">
                        {p.product_name}
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                        <div className="text-muted-foreground">Quantità</div>
                        <div className="text-right tabular-nums">{p.total_qty}{p.unit ? ` ${formatUnit(p.unit)}` : ''}</div>
                        <div className="text-muted-foreground">Sconto medio</div>
                        <div className="text-right tabular-nums">{p.avg_discount}%</div>
                        <div className="text-muted-foreground">Ricavi</div>
                        <div className="text-right tabular-nums font-medium">{euro(p.revenue)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="w-full overflow-x-auto rounded-md border">
                  <Table className="compact-table">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Prodotto</TableHead>
                        <TableHead className="text-right">Quantità</TableHead>
                        <TableHead className="text-right">Sconto medio</TableHead>
                        <TableHead className="text-right">Ricavi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPerProd.map((p) => (
                        <TableRow key={p.product_id}>
                          <TableCell className="break-words">
                            {p.product_name}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {p.total_qty}{p.unit ? ` ${formatUnit(p.unit)}` : ''}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{p.avg_discount}%</TableCell>
                          <TableCell className="text-right tabular-nums">{euro(p.revenue)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
