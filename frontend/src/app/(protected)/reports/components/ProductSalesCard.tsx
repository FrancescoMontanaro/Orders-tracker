'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api-client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { DatePicker } from '@/components/ui/date-picker';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { ResponsiveContainer, BarChart, Bar, XAxis, CartesianGrid } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import type { SuccessResponse } from '@/types/api';
import type { ProductSalesRow } from '../types/productSales';
import { MultiProductCombobox } from './MultiProductCombobox';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { euro } from '../utils/currency';
import { addDays, toIsoDate } from '../utils/date';
import type { Option } from '../hooks/useRemoteSearch';
import { FilterToggleButton } from '@/components/ui/filter-toggle-button';

/* Helpers (same as above for consistency) */
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

const productChartConfig = {
  revenue: { label: 'Ricavi (EUR)', color: 'var(--chart-1)' },
  total_qty: { label: 'Quantità (unità)', color: 'var(--chart-2)' },
} satisfies ChartConfig;

type TWMode = 'none' | 'top5' | 'top10' | 'worst5' | 'worst10';

function applyTopWorst<T extends { revenue: number }>(rows: T[], mode: TWMode): T[] {
  if (mode === 'none') return rows;
  const n = mode.includes('10') ? 10 : 5;
  const sorted = [...rows].sort((a, b) => b.revenue - a.revenue);
  if (mode.startsWith('top')) return sorted.slice(0, n);
  return sorted.slice(-n);
}

/**
 * ProductSalesCard (responsive + Top/Worst single-select)
 */
export function ProductSalesCard() {
  const isSmall = useIsSmallScreen();

  const sp = useSearchParams();
  const productIdFromUrl = Number(sp.get('product_id') || 0) || 0;

  const today = new Date();
  const defaultEnd = toIsoDate(today);
  const defaultStart = toIsoDate(addDays(today, -30));

  const [start, setStart] = React.useState<string>(defaultStart);
  const [end, setEnd] = React.useState<string>(defaultEnd);
  const [products, setProducts] = React.useState<Option[]>(
    productIdFromUrl ? [{ id: productIdFromUrl, name: `#${productIdFromUrl}` }] : []
  );

  const [rows, setRows] = React.useState<ProductSalesRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [topWorst, setTopWorst] = React.useState<TWMode>('none');
  const [mobileFiltersOpen, setMobileFiltersOpen] = React.useState(false);

  const debouncedProducts = useDebouncedValue(products, 250);
  const debouncedStart = useDebouncedValue(start, 250);
  const debouncedEnd = useDebouncedValue(end, 250);

  const fetchReport = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = {
        start_date: debouncedStart,
        end_date: debouncedEnd,
        product_ids: debouncedProducts.map((p: Option) => Number(p.id)), // empty => all
      };
      const res = await api.post<SuccessResponse<ProductSalesRow[]>>('/reports/product-sales', payload, {
        headers: { 'Content-Type': 'application/json' },
      });
      const data = (res.data as any).data ?? res.data;
      const list = Array.isArray(data) ? data : [];
      setRows(list);

      if (products.length === 1 && products[0].name.startsWith('#')) {
        const match = list.find((r) => r.product_id === products[0].id);
        if (match) {
          setProducts([{ id: match.product_id, name: match.product_name, unit: match.unit ?? null }]);
        }
      }
    } catch (e: any) {
      const detail = e?.response?.data?.detail ?? e?.response?.data?.message ?? e?.message ?? 'Errore sconosciuto';
      setError(String(detail));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedProducts, debouncedStart, debouncedEnd]); // eslint-disable-line

  React.useEffect(() => { fetchReport(); }, [fetchReport]);

  const filteredRows = applyTopWorst(rows, topWorst);

  // Horizontal scroll width for bars
  const BAR_WIDTH = 48;
  const MIN_INNER = Math.max(filteredRows.length * BAR_WIDTH + 60, 0);

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
        <CardTitle>Vendite per Prodotto</CardTitle>
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
              <Label>Prodotti</Label>
              <MultiProductCombobox
                values={products}
                onChange={setProducts}
                placeholder="Tutti i prodotti…"
                emptyText="Nessun prodotto"
                clearLabel="Tutti i prodotti"
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
            <Label>Prodotti</Label>
            <MultiProductCombobox
              values={products}
              onChange={setProducts}
              placeholder="Tutti i prodotti…"
              emptyText="Nessun prodotto"
              clearLabel="Tutti i prodotti"
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

        {/* Chart + Table/Card */}
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : error ? (
          <div className="text-sm text-red-600">{error}</div>
        ) : filteredRows.length === 0 ? (
          <div className="text-sm text-muted-foreground">Nessun dato per i filtri selezionati.</div>
        ) : (
          <>
            {/* Bars with horizontal scroll only if needed */}
            <div ref={barOuterRef} className="w-full overflow-x-auto rounded-md border">
              <div
                className="h-[300px] sm:h-[320px]"
                // If calculated inner width ≤ container width, we clamp to container width => no scroll & 100% width
                style={{ minWidth: Math.max(MIN_INNER, barOuterWidth || 0) }}
              >
                <ChartContainer config={productChartConfig} className="h-full w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart accessibilityLayer data={filteredRows}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis
                        dataKey="product_name"
                        tickLine={false}
                        tickMargin={10}
                        axisLine={false}
                        tickFormatter={(name: string, idx: number) => {
                          const base = filteredRows[idx]?.unit ? `${name} (${filteredRows[idx].unit})` : name;
                          return isSmall ? truncateLabel(base) : base;
                        }}
                      />
                      <ChartTooltip
                        cursor={false}
                        content={
                          <ChartTooltipContent
                            indicator="dashed"
                            labelFormatter={(_, payload) => {
                              const row = (payload?.[0]?.payload || {}) as ProductSalesRow;
                              return row.unit ? `${row.product_name} (${row.unit})` : row.product_name;
                            }}
                          />
                        }
                      />
                      <Bar dataKey="revenue" name={productChartConfig.revenue.label} fill="var(--color-revenue)" radius={4} />
                      <Bar dataKey="total_qty" name={productChartConfig.total_qty.label} fill="var(--color-total_qty)" radius={4} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </div>
            </div>

            {/* Detail: table on desktop, cards on mobile */}
            {isSmall ? (
              <div className="space-y-2">
                {filteredRows.map((r) => (
                  <div key={r.product_id} className="rounded-md border p-3">
                    <div className="font-medium break-words">
                      {r.product_name}
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                      <div className="text-muted-foreground">Quantità</div>
                      <div className="text-right tabular-nums">
                        {r.total_qty}{r.unit ? ` ${r.unit}` : ''}
                      </div>
                      <div className="text-muted-foreground">Ricavi</div>
                      <div className="text-right tabular-nums font-medium">{euro(r.revenue)}</div>
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
                      <TableHead className="text-right">Ricavi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRows.map((r) => (
                      <TableRow key={r.product_id}>
                        <TableCell className="break-words">
                          {r.product_name}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {r.total_qty}{r.unit ? ` ${r.unit}` : ''}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{euro(r.revenue)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
