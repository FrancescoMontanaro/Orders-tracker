'use client';

import * as React from 'react';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useSearchParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { MultiExpenseCategoryCombobox } from './MultiExpenseCategoryCombobox';
import { useDebouncedValue } from '@/app/(protected)/balance/hooks/useDebouncedValue';
import type { SuccessResponse } from '@/types/api';
import type { Option } from '../hooks/useRemoteSearch';
import { euro } from '@/app/(protected)/balance/utils/currency';
import { addDays, toIsoDate } from '../utils/date';
import { Filter, ChevronDown } from 'lucide-react';

/* ---------- Types for this report ---------- */

export type ExpenseCategoryReportRow = {
  category_id: number;
  category_descr: string;
  amount: number;
  count: number;
};

/* ---------- Small helpers (same approach as product card) ---------- */

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

function truncateLabel(s: string, max = 18) {
  if (!s) return s;
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

/* Chart config: show two series (Amount €, Count) */
const categoryChartConfig = {
  amount: { label: 'Totale (EUR)', color: 'var(--chart-1)' },
  count: { label: 'Numero uscite', color: 'var(--chart-2)' },
} satisfies ChartConfig;

type TWMode = 'none' | 'top5' | 'top10' | 'worst5' | 'worst10';

function applyTopWorst<T extends { amount: number }>(rows: T[], mode: TWMode): T[] {
  if (mode === 'none') return rows;
  const n = mode.includes('10') ? 10 : 5;
  const sorted = [...rows].sort((a, b) => b.amount - a.amount);
  if (mode.startsWith('top')) return sorted.slice(0, n);
  return sorted.slice(-n);
}

/**
 * CategoryExpensesCard (responsive + Top/Worst single-select)
 * - Same UX as ProductSalesCard
 * - Filters: date range + multi-category
 * - Chart: amount + count (two bars)
 */
export function CategoryExpensesCard() {
  const isSmall = useIsSmallScreen();

  const sp = useSearchParams();
  const categoryIdFromUrl = Number(sp.get('category_id') || 0) || 0;

  const today = new Date();
  const defaultEnd = toIsoDate(today);
  const defaultStart = toIsoDate(addDays(today, -30));

  const [start, setStart] = React.useState<string>(defaultStart);
  const [end, setEnd] = React.useState<string>(defaultEnd);
  const [categories, setCategories] = React.useState<Option[]>(
    categoryIdFromUrl ? [{ id: categoryIdFromUrl, name: `#${categoryIdFromUrl}` }] : []
  ); // Option: { id, name }

  const [rows, setRows] = React.useState<ExpenseCategoryReportRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [topWorst, setTopWorst] = React.useState<TWMode>('none');
  const [mobileFiltersOpen, setMobileFiltersOpen] = React.useState(false);

  const debouncedCats = useDebouncedValue(categories, 250);
  const debouncedStart = useDebouncedValue(start, 250);
  const debouncedEnd = useDebouncedValue(end, 250);

  const fetchReport = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = {
        start_date: debouncedStart,
        end_date: debouncedEnd,
        category_ids: debouncedCats.map((c) => Number(c.id)), // empty => all
      };
      const res = await api.post<SuccessResponse<ExpenseCategoryReportRow[]>>('/reports/expenses', payload, {
        headers: { 'Content-Type': 'application/json' },
      });
      const data = (res.data as any).data ?? res.data;
      const list: ExpenseCategoryReportRow[] = Array.isArray(data) ? data : [];
      setRows(list);

      // If category came from URL with placeholder label (#id), replace with real descr when available
      if (categories.length === 1 && String(categories[0].name).startsWith('#')) {
        const match = list.find((r) => r.category_id === categories[0].id);
        if (match) {
          setCategories([{ id: match.category_id, name: match.category_descr }]);
        }
      }
    } catch (e: any) {
      const detail = e?.response?.data?.detail ?? e?.response?.data?.message ?? e?.message ?? 'Errore sconosciuto';
      setError(String(detail));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedCats, debouncedStart, debouncedEnd]); // eslint-disable-line

  React.useEffect(() => { fetchReport(); }, [fetchReport]);

  const filteredRows = applyTopWorst(rows, topWorst);

  // Horizontal scroll width for bars
  const BAR_WIDTH = 48;
  const MIN_INNER = Math.max(filteredRows.length * BAR_WIDTH + 60, 0);

  // Measure container to avoid forced scroll
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
        <CardTitle>Uscite per Categoria</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 overflow-x-hidden">
        {/* Filters */}
        <div className="hidden md:grid gap-3 md:grid-cols-5 min-w-0">
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
              <Label>Categorie</Label>
              <MultiExpenseCategoryCombobox
                values={categories}
                onChange={setCategories}
                placeholder="Tutte le categorie…"
                emptyText="Nessuna categoria"
                clearLabel="Tutte le categorie"
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
                  <SelectItem value="top5">5 più costose (totale €)</SelectItem>
                  <SelectItem value="top10">10 più costose (totale €)</SelectItem>
                  <SelectItem value="worst5">5 meno costose (totale €)</SelectItem>
                  <SelectItem value="worst10">10 meno costose (totale €)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Mobile filters */}
        <div className="md:hidden space-y-3">
          <Button
            variant="outline"
            onClick={() => setMobileFiltersOpen((prev) => !prev)}
            className="flex w-full items-center justify-between gap-2"
          >
            <span className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              {mobileFiltersOpen ? 'Nascondi filtri' : 'Mostra filtri'}
            </span>
            <ChevronDown className={cn('h-4 w-4 transition-transform', mobileFiltersOpen && 'rotate-180')} />
          </Button>

          {mobileFiltersOpen && (
            <div className="space-y-3">
              <div className="grid gap-1 min-w-0">
                <Label>Da</Label>
                <DatePicker value={start} onChange={setStart} placeholder="Data da" className="min-w-0 w-full" />
              </div>
              <div className="grid gap-1 min-w-0">
                <Label>A</Label>
                <DatePicker value={end} onChange={setEnd} placeholder="Data a" className="min-w-0 w-full" />
              </div>
              <div className="grid gap-1 min-w-0">
                <Label>Categorie</Label>
                <MultiExpenseCategoryCombobox
                  values={categories}
                  onChange={setCategories}
                  placeholder="Tutte le categorie…"
                  emptyText="Nessuna categoria"
                  clearLabel="Tutte le categorie"
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
                    <SelectItem value="top5">5 più costose (totale €)</SelectItem>
                    <SelectItem value="top10">10 più costose (totale €)</SelectItem>
                    <SelectItem value="worst5">5 meno costose (totale €)</SelectItem>
                    <SelectItem value="worst10">10 meno costose (totale €)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
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
                style={{ minWidth: Math.max(MIN_INNER, barOuterWidth || 0) }}
              >
                <ChartContainer config={categoryChartConfig} className="h-full w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart accessibilityLayer data={filteredRows}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis
                        dataKey="category_descr"
                        tickLine={false}
                        tickMargin={10}
                        axisLine={false}
                        tickFormatter={(name: string) => isSmall ? truncateLabel(name) : name}
                      />
                      <ChartTooltip
                        cursor={false}
                        content={
                          <ChartTooltipContent
                            indicator="dashed"
                            labelFormatter={(label) => String(label)}
                          />
                        }
                      />
                      <Bar dataKey="amount" name={categoryChartConfig.amount.label} fill="var(--color-amount)" radius={4} />
                      <Bar dataKey="count" name={categoryChartConfig.count.label} fill="var(--color-count)" radius={4} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </div>
            </div>

            {/* Detail: table on desktop, cards on mobile */}
            {isSmall ? (
              <div className="space-y-2">
                {filteredRows.map((r) => (
                  <div key={r.category_id} className="rounded-md border p-3">
                    <div className="font-medium break-words">
                      {r.category_descr}
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                      <div className="text-muted-foreground">Numero uscite</div>
                      <div className="text-right tabular-nums">{r.count}</div>
                      <div className="text-muted-foreground">Totale</div>
                      <div className="text-right tabular-nums font-medium">{euro(r.amount)}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="w-full overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Categoria</TableHead>
                      <TableHead className="text-right">Numero uscite</TableHead>
                      <TableHead className="text-right">Totale</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRows.map((r) => (
                      <TableRow key={r.category_id}>
                        <TableCell className="break-words">{r.category_descr}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.count}</TableCell>
                        <TableCell className="text-right tabular-nums">{euro(r.amount)}</TableCell>
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
