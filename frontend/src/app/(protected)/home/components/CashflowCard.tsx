'use client';

import * as React from 'react';
import { FileDown, Loader2, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { api } from '@/lib/api-client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { FilterToggleButton } from '@/components/ui/filter-toggle-button';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  CashflowResponse,
  CategoryRow,
  CompareMode,
  Granularity,
  SuccessResponse,
} from '../types/cashflow';
import { euro } from '../utils/currency';
import CashflowDrilldownDialog from './CashflowDrilldownDialog';

/* ============================================================
 * Date helpers (UTC-safe)
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

/** Crea una data UTC (00:00) da YYYY-MM-DD */
function dateUTCFromISO(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Ritorna YYYY-MM-DD da una Date considerandola UTC */
function toISOUTC(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function firstLastDayOfCurrentMonth() {
  const now = new Date();
  const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  return { start: toISOUTC(first), end: toISOUTC(last) };
}

/** Somma giorni in UTC a una data (YYYY-MM-DD) */
function addDaysUTC(dateISO: string, deltaDays: number) {
  const d = dateUTCFromISO(dateISO);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return toISOUTC(d);
}

/** Sposta una data di N anni, agganciando il giorno alla fine mese se serve (29 feb → 28 feb) */
function addYearsUTC(dateISO: string, deltaYears: number) {
  const [y, m, d] = dateISO.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y + deltaYears, m, 0)).getUTCDate();
  return toISOUTC(new Date(Date.UTC(y + deltaYears, m - 1, Math.min(d, lastDay))));
}

/** Compute number of days between two ISO dates (inclusive, UTC-safe) */
function daysInclusive(startISO: string, endISO: string) {
  const a = dateUTCFromISO(startISO).getTime();
  const b = dateUTCFromISO(endISO).getTime();
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
}

/** Weekday label (it-IT) from ISO date */
function weekdayLabel(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('it-IT', { weekday: 'short' });
}

/** Formatter per date complete leggibili (es. "15 lug 2026") */
function fmtDateFullIT(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** Compact euro label for chart axes (es. "1,2k €") */
function euroCompact(v: number) {
  const abs = Math.abs(v);
  if (abs >= 1000) {
    return `${(v / 1000).toLocaleString('it-IT', { maximumFractionDigits: 1 })}k €`;
  }
  return `${v.toLocaleString('it-IT', { maximumFractionDigits: 0 })} €`;
}

/**
 * Periodo di confronto:
 * - 'year': stesso intervallo, un anno prima.
 * - 'previous': se l'intervallo è allineato a mesi di calendario (dal 1° all'ultimo giorno
 *   del mese) usa gli N mesi di calendario precedenti (es. luglio → giugno intero);
 *   altrimenti stessa lunghezza in giorni, terminando il giorno prima dell'inizio.
 */
function prevPeriodRange(startISO: string, endISO: string, mode: CompareMode) {
  if (mode === 'year') {
    return { start: addYearsUTC(startISO, -1), end: addYearsUTC(endISO, -1) };
  }
  const s = dateUTCFromISO(startISO);
  const e = dateUTCFromISO(endISO);
  const lastDayOfEndMonth = new Date(Date.UTC(e.getUTCFullYear(), e.getUTCMonth() + 1, 0)).getUTCDate();
  const isMonthAligned = s.getUTCDate() === 1 && e.getUTCDate() === lastDayOfEndMonth && s <= e;
  if (isMonthAligned) {
    const monthsSpan =
      (e.getUTCFullYear() - s.getUTCFullYear()) * 12 + (e.getUTCMonth() - s.getUTCMonth()) + 1;
    const prevStart = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() - monthsSpan, 1));
    const prevEnd = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), 0));
    return { start: toISOUTC(prevStart), end: toISOUTC(prevEnd) };
  }
  const len = daysInclusive(startISO, endISO);
  const prevEnd = addDaysUTC(startISO, -1);
  return { start: addDaysUTC(prevEnd, -(len - 1)), end: prevEnd };
}

/* ============================================================
 * Series building (client-side aggregation with gap filling)
 * ============================================================ */

type SeriesRow = { label: string; in: number; out: number; net: number };

function keyForGranularity(iso: string, gran: Granularity) {
  return gran === 'daily' ? iso : gran === 'monthly' ? iso.slice(0, 7) : iso.slice(0, 4);
}

/**
 * Genera tutte le chiavi-periodo dell'intervallo, così i periodi senza movimenti
 * compaiono comunque (a zero) e l'asse temporale resta regolare.
 * Ritorna null oltre una soglia di sicurezza (range daily enormi): in quel caso
 * si ripiega sulle sole chiavi presenti nei dati.
 */
function periodKeys(fromISO: string, toISO: string, gran: Granularity): string[] | null {
  if (fromISO > toISO) return [];
  if (gran === 'daily') {
    const n = daysInclusive(fromISO, toISO);
    if (n > 750) return null;
    const out: string[] = [];
    let cur = fromISO;
    for (let i = 0; i < n; i++) {
      out.push(cur);
      cur = addDaysUTC(cur, 1);
    }
    return out;
  }
  if (gran === 'monthly') {
    const [fy, fm] = fromISO.split('-').map(Number);
    const [ty, tm] = toISO.split('-').map(Number);
    const out: string[] = [];
    for (let y = fy, m = fm; y < ty || (y === ty && m <= tm); ) {
      out.push(`${y}-${String(m).padStart(2, '0')}`);
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
      if (out.length > 1200) return null;
    }
    return out;
  }
  const fy = Number(fromISO.slice(0, 4));
  const ty = Number(toISO.slice(0, 4));
  if (ty - fy > 100) return null;
  return Array.from({ length: ty - fy + 1 }, (_, i) => String(fy + i));
}

function buildSeries(
  data: CashflowResponse,
  from: string,
  to: string,
  gran: Granularity,
  includeIncomes: boolean
): SeriesRow[] {
  const agg = new Map<string, { in: number; out: number }>();
  const bump = (iso: string, dIn: number, dOut: number) => {
    const k = keyForGranularity(iso, gran);
    const cur = agg.get(k) ?? { in: 0, out: 0 };
    cur.in += dIn;
    cur.out += dOut;
    agg.set(k, cur);
  };
  (data.entries ?? []).forEach((e) => bump(e.date, Number(e.amount || 0), 0));
  if (includeIncomes) (data.incomes ?? []).forEach((i) => bump(i.date, Number(i.amount || 0), 0));
  (data.expenses ?? []).forEach((x) => bump(x.date, 0, Number(x.amount || 0)));

  const keys = periodKeys(from, to, gran) ?? [...agg.keys()].sort();
  return keys.map((k) => {
    const v = agg.get(k) ?? { in: 0, out: 0 };
    return { label: k, in: v.in, out: v.out, net: v.in - v.out };
  });
}

function computeTotals(data: CashflowResponse, includeIncomes: boolean) {
  const tIn =
    (data.entries ?? []).reduce((a, e) => a + Number(e.amount || 0), 0) +
    (includeIncomes ? (data.incomes ?? []).reduce((a, i) => a + Number(i.amount || 0), 0) : 0);
  const tOut = (data.expenses ?? []).reduce((a, x) => a + Number(x.amount || 0), 0);
  return { in: tIn, out: tOut, net: tIn - tOut };
}

/* ============================================================
 * Chart configs & shared tooltip formatter
 * ============================================================ */

const mainChartConfig = {
  in: { label: 'Entrate', color: 'var(--chart-1)' },
  out: { label: 'Uscite', color: 'var(--chart-2)' },
  net: { label: 'Netto', color: 'var(--chart-3)' },
  prevNet: { label: 'Netto (confronto)', color: 'var(--muted-foreground)' },
} satisfies ChartConfig;

const cumChartConfig = {
  cnet: { label: 'Netto cumulato', color: 'var(--chart-4)' },
} satisfies ChartConfig;

const weekdayConfig = {
  amount: { label: 'Netto', color: 'var(--chart-5)' },
} satisfies ChartConfig;

const PIE_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];

/** Renders tooltip rows with euro-formatted values (colored dot + name + amount) */
const euroTooltipFormatter = (value: unknown, name: unknown, item: unknown) => {
  if (value === null || value === undefined) return null;
  const it = item as { color?: string; payload?: { fill?: string } } | undefined;
  return (
    <>
      <div
        className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
        style={{ background: it?.payload?.fill || it?.color }}
      />
      <div className="flex flex-1 items-center justify-between gap-4 leading-none">
        <span className="text-muted-foreground">{String(name)}</span>
        <span className="text-foreground font-mono font-medium tabular-nums">
          {euro(Number(value))}
        </span>
      </div>
    </>
  );
};

/* ============================================================
 * Small presentational pieces
 * ============================================================ */

function KpiTile({
  label,
  value,
  valueClass,
  sub,
  children,
}: {
  label: string;
  value: React.ReactNode;
  valueClass?: string;
  sub?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border p-3 min-w-0">
      <div className="text-xs uppercase tracking-wide text-muted-foreground truncate">{label}</div>
      <div className={cn('mt-1 text-lg sm:text-xl font-semibold tabular-nums truncate', valueClass)}>
        {value}
      </div>
      {children}
      {sub && <div className="mt-0.5 text-[11px] text-muted-foreground truncate">{sub}</div>}
    </div>
  );
}

/** Delta vs periodo di confronto; goodWhen indica quale direzione è positiva per il business */
function DeltaBadge({
  curr,
  prev,
  goodWhen = 'up',
}: {
  curr: number;
  prev: number;
  goodWhen?: 'up' | 'down';
}) {
  const d = curr - prev;
  const pct = prev !== 0 ? (Math.abs(d) / Math.abs(prev)) * 100 : null;
  const sign = d > 0 ? '+' : d < 0 ? '−' : '';
  const good = d === 0 ? null : goodWhen === 'up' ? d > 0 : d < 0;
  const cls =
    good === null
      ? 'text-muted-foreground'
      : good
        ? 'text-emerald-600 dark:text-emerald-400'
        : 'text-red-600 dark:text-red-400';
  const Icon = d > 0 ? TrendingUp : d < 0 ? TrendingDown : Minus;
  return (
    <div className={cn('mt-1 flex items-center gap-1 text-xs', cls)}>
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="tabular-nums truncate">
        {sign}
        {euro(Math.abs(d))}
        {pct !== null ? ` (${sign}${pct.toFixed(1)}%)` : ''}
      </span>
    </div>
  );
}

function CategoryBreakdown({ title, rows }: { title: string; rows: CategoryRow[] }) {
  const total = rows.reduce((a, r) => a + r.amount, 0);
  const config = { amount: { label: 'Importo (EUR)' } } satisfies ChartConfig;
  return (
    <div className="rounded-md border p-3 min-w-0 space-y-2">
      <div className="text-sm font-medium">{title}</div>
      {!rows.length || total <= 0 ? (
        <div className="text-sm text-muted-foreground py-6 text-center">
          Nessun dato nel periodo selezionato.
        </div>
      ) : (
        <>
          <div className="h-[200px]">
            <ChartContainer config={config} className="h-full w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <ChartTooltip
                    content={
                      <ChartTooltipContent hideLabel formatter={euroTooltipFormatter} />
                    }
                  />
                  <Pie
                    data={rows}
                    dataKey="amount"
                    nameKey="category_descr"
                    innerRadius="55%"
                    outerRadius="85%"
                    paddingAngle={2}
                    strokeWidth={2}
                  >
                    {rows.map((r, idx) => (
                      <Cell key={r.category_id} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </ChartContainer>
          </div>
          <ul className="space-y-1.5">
            {rows.map((r, idx) => (
              <li key={r.category_id} className="flex items-center gap-2 text-sm min-w-0">
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ background: PIE_COLORS[idx % PIE_COLORS.length] }}
                  aria-hidden="true"
                />
                <span className="truncate flex-1 min-w-0">{r.category_descr}</span>
                <span className="tabular-nums text-xs text-muted-foreground shrink-0">
                  {((r.amount / total) * 100).toFixed(1)}%
                </span>
                <span className="tabular-nums font-medium shrink-0">{euro(r.amount)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/* ============================================================
 * Presets
 * ============================================================ */

type Preset = { key: string; label: string; from: string; to: string; gran: Granularity };

function buildPresets(): Preset[] {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const todayISO = toISOUTC(now);
  const cur = firstLastDayOfCurrentMonth();
  const prevFirst = toISOUTC(new Date(Date.UTC(y, m - 1, 1)));
  const prevLast = toISOUTC(new Date(Date.UTC(y, m, 0)));
  return [
    { key: 'month', label: 'Questo mese', from: cur.start, to: cur.end, gran: 'daily' },
    { key: 'prev-month', label: 'Mese scorso', from: prevFirst, to: prevLast, gran: 'daily' },
    { key: 'last-30', label: 'Ultimi 30 giorni', from: addDaysUTC(todayISO, -29), to: todayISO, gran: 'daily' },
    { key: 'ytd', label: 'Anno corrente', from: `${y}-01-01`, to: todayISO, gran: 'monthly' },
    { key: 'last-year', label: 'Anno scorso', from: `${y - 1}-01-01`, to: `${y - 1}-12-31`, gran: 'monthly' },
  ];
}

/* ============================================================
 * CashflowCard
 * ============================================================ */

type LoadedData = {
  range: { from: string; to: string };
  prevRange: { start: string; end: string };
  current: CashflowResponse;
  previous: CashflowResponse;
  expenseCats: CategoryRow[];
  incomeCats: CategoryRow[];
};

export default function CashflowCard() {
  // Defaults to current month
  const initialRange = React.useMemo(firstLastDayOfCurrentMonth, []);
  const [dateFrom, setDateFrom] = React.useState<string>(initialRange.start);
  const [dateTo, setDateTo] = React.useState<string>(initialRange.end);
  const [gran, setGran] = React.useState<Granularity>('daily');
  const [includeIncomes, setIncludeIncomes] = React.useState(true);
  const [compareMode, setCompareMode] = React.useState<CompareMode>('previous');
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [raw, setRaw] = React.useState<LoadedData | null>(null);
  const [drillLabel, setDrillLabel] = React.useState<string | null>(null);

  const presets = React.useMemo(buildPresets, []);

  // ---- data loader: current + comparison period + category breakdowns, in parallel ----
  // Incomes are always requested; the "includi entrate" toggle filters client-side (instant).
  const seqRef = React.useRef(0);
  const load = React.useCallback(async () => {
    if (dateFrom > dateTo) {
      setError('La data iniziale deve essere precedente o uguale alla data finale.');
      setRaw(null);
      setLoading(false);
      return;
    }
    const seq = ++seqRef.current;
    setLoading(true);
    setError(null);
    try {
      const prevRange = prevPeriodRange(dateFrom, dateTo, compareMode);
      const [current, previous, expenseCats, incomeCats] = await Promise.all([
        api
          .post<SuccessResponse<CashflowResponse>>('/reports/cashflow', {
            start_date: dateFrom,
            end_date: dateTo,
            include_incomes: true,
          })
          .then((r) => r.data.data),
        api
          .post<SuccessResponse<CashflowResponse>>('/reports/cashflow', {
            start_date: prevRange.start,
            end_date: prevRange.end,
            include_incomes: true,
          })
          .then((r) => r.data.data),
        // Category breakdowns are secondary: degrade gracefully if they fail
        api
          .post<SuccessResponse<CategoryRow[]>>('/reports/expenses', {
            start_date: dateFrom,
            end_date: dateTo,
          })
          .then((r) => r.data.data)
          .catch(() => [] as CategoryRow[]),
        api
          .post<SuccessResponse<CategoryRow[]>>('/reports/incomes', {
            start_date: dateFrom,
            end_date: dateTo,
          })
          .then((r) => r.data.data)
          .catch(() => [] as CategoryRow[]),
      ]);
      if (seq !== seqRef.current) return; // a newer request superseded this one
      setRaw({ range: { from: dateFrom, to: dateTo }, prevRange, current, previous, expenseCats, incomeCats });
    } catch (e) {
      if (seq !== seqRef.current) return;
      const err = e as { response?: { data?: { detail?: unknown; message?: unknown } }; message?: string };
      const detail = err.response?.data?.detail ?? err.response?.data?.message ?? err.message ?? 'Errore sconosciuto';
      setError(`Impossibile caricare il cashflow: ${String(detail)}`);
      setRaw(null);
    } finally {
      if (seq === seqRef.current) setLoading(false);
    }
  }, [dateFrom, dateTo, compareMode]);

  React.useEffect(() => {
    load();
  }, [load]);

  // ---- filter handlers ----
  // On long ranges, daily bars become unreadable: auto-coarsen to monthly (user can override after)
  const coarsenIfLongRange = React.useCallback((from: string, to: string) => {
    if (from && to && from <= to && daysInclusive(from, to) > 92) {
      setGran((g) => (g === 'daily' ? 'monthly' : g));
    }
  }, []);

  const handleDateFrom = React.useCallback(
    (v: string) => {
      setDateFrom(v);
      coarsenIfLongRange(v, dateTo);
    },
    [dateTo, coarsenIfLongRange]
  );

  const handleDateTo = React.useCallback(
    (v: string) => {
      setDateTo(v);
      coarsenIfLongRange(dateFrom, v);
    },
    [dateFrom, coarsenIfLongRange]
  );

  const applyPreset = React.useCallback((p: Preset) => {
    setDateFrom(p.from);
    setDateTo(p.to);
    setGran(p.gran);
  }, []);

  const resetFilters = React.useCallback(() => {
    const d = firstLastDayOfCurrentMonth();
    setDateFrom(d.start);
    setDateTo(d.end);
    setGran('daily');
    setIncludeIncomes(true);
    setCompareMode('previous');
  }, []);

  /* ---- derived data (all client-side: granularity/incomes toggles never refetch) ---- */

  const series = React.useMemo<SeriesRow[]>(
    () => (raw ? buildSeries(raw.current, raw.range.from, raw.range.to, gran, includeIncomes) : []),
    [raw, gran, includeIncomes]
  );
  const prevSeries = React.useMemo<SeriesRow[]>(
    () => (raw ? buildSeries(raw.previous, raw.prevRange.start, raw.prevRange.end, gran, includeIncomes) : []),
    [raw, gran, includeIncomes]
  );

  const totals = React.useMemo(
    () => (raw ? computeTotals(raw.current, includeIncomes) : { in: 0, out: 0, net: 0 }),
    [raw, includeIncomes]
  );
  const prevTotals = React.useMemo(
    () => (raw ? computeTotals(raw.previous, includeIncomes) : { in: 0, out: 0, net: 0 }),
    [raw, includeIncomes]
  );

  const prevHasData = React.useMemo(() => prevSeries.some((r) => r.in || r.out), [prevSeries]);

  // Main chart rows: current series + comparison net overlay aligned by position
  const mainSeries = React.useMemo(
    () =>
      series.map((r, i) => ({
        ...r,
        prevNet: prevHasData ? (prevSeries[i]?.net ?? null) : null,
      })),
    [series, prevSeries, prevHasData]
  );

  const cumulative = React.useMemo(() => {
    let acc = 0;
    return series.map((r) => {
      acc += r.net;
      return { label: r.label, cnet: acc };
    });
  }, [series]);

  const bestIn = React.useMemo(() => {
    let best: { label: string; value: number } | null = null;
    for (const r of series) if (r.in > 0 && (!best || r.in > best.value)) best = { label: r.label, value: r.in };
    return best;
  }, [series]);

  const worstOut = React.useMemo(() => {
    let worst: { label: string; value: number } | null = null;
    for (const r of series) if (r.out > 0 && (!worst || r.out > worst.value)) worst = { label: r.label, value: r.out };
    return worst;
  }, [series]);

  const avgNet = series.length ? totals.net / series.length : 0;

  const weekdayRows = React.useMemo(() => {
    if (!raw) return [];
    const acc: Record<string, number> = {};
    const add = (iso: string, amount: number) => {
      const wd = weekdayLabel(iso);
      acc[wd] = (acc[wd] ?? 0) + amount;
    };
    raw.current.entries.forEach((e) => add(e.date, Number(e.amount || 0)));
    if (includeIncomes) raw.current.incomes.forEach((i) => add(i.date, Number(i.amount || 0)));
    raw.current.expenses.forEach((x) => add(x.date, -Number(x.amount || 0)));
    const order = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'];
    return order.map((day) => ({ day, amount: Number(acc[day] ?? 0) }));
  }, [raw, includeIncomes]);

  // Extra KPIs
  const movementsCount = raw
    ? raw.current.entries.length + raw.current.expenses.length + (includeIncomes ? raw.current.incomes.length : 0)
    : 0;
  const avgOrderTicket =
    raw && raw.current.entries.length
      ? raw.current.entries.reduce((a, e) => a + Number(e.amount || 0), 0) / raw.current.entries.length
      : null;
  const marginPct = totals.in > 0 ? (totals.net / totals.in) * 100 : null;

  // End-of-period projection (only when the loaded range includes today and isn't over)
  const projection = React.useMemo(() => {
    if (!raw) return null;
    const todayISO = toISOUTC(new Date());
    const { from, to } = raw.range;
    if (todayISO < from || todayISO >= to) return null;
    const elapsed = daysInclusive(from, todayISO);
    const total = daysInclusive(from, to);
    if (elapsed >= total) return null;
    return (totals.net / elapsed) * total;
  }, [raw, totals.net]);

  // Category breakdowns (only categories with movements, sorted by amount)
  const expenseCatRows = React.useMemo(
    () => (raw?.expenseCats ?? []).filter((c) => c.amount > 0).sort((a, b) => b.amount - a.amount),
    [raw]
  );
  const incomeCatRows = React.useMemo(
    () => (raw?.incomeCats ?? []).filter((c) => c.amount > 0).sort((a, b) => b.amount - a.amount),
    [raw]
  );

  // Drill-down data for the selected period
  const drillData = React.useMemo(() => {
    if (!drillLabel || !raw) return null;
    const inPeriod = (iso: string) => keyForGranularity(iso, gran) === drillLabel;
    return {
      entries: raw.current.entries.filter((e) => inPeriod(e.date)),
      incomes: includeIncomes ? raw.current.incomes.filter((i) => inPeriod(i.date)) : [],
      expenses: raw.current.expenses.filter((x) => inPeriod(x.date)),
    };
  }, [drillLabel, raw, gran, includeIncomes]);

  const drillTitle = drillLabel
    ? gran === 'daily'
      ? fmtDateFullIT(drillLabel)
      : labelFromISO(drillLabel)
    : '';

  // CSV export of the detail table (Italian Excel-friendly: semicolon + decimal comma + BOM)
  const exportCsv = React.useCallback(() => {
    const sep = ';';
    const num = (n: number) => n.toFixed(2).replace('.', ',');
    const lines = [
      ['Periodo', 'Entrate', 'Uscite', 'Netto'].join(sep),
      ...series.map((r) => [labelFromISO(r.label), num(r.in), num(r.out), num(r.net)].join(sep)),
      ['Totale', num(totals.in), num(totals.out), num(totals.net)].join(sep),
    ];
    const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cashflow_${raw?.range.from ?? dateFrom}_${raw?.range.to ?? dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [series, totals, raw, dateFrom, dateTo]);

  /* ---- layout helpers ---- */

  const hasData = series.some((r) => r.in || r.out);
  const isRefreshing = loading && !!raw;
  const initialLoading = loading && !raw && !error;
  const netClass = totals.net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400';

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

  const granLabel = gran === 'daily' ? 'al giorno' : gran === 'monthly' ? 'al mese' : "all'anno";

  return (
    <Card className="w-full max-w-full overflow-x-hidden">
      {/* ===== Header ===== */}
      <CardHeader className="space-y-1">
        <CardTitle className="min-w-0 flex items-center gap-2">
          Cashflow
          {isRefreshing && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Aggiornamento in corso" />
          )}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Le entrate considerano solo gli ordini consegnati, più le entrate extra se incluse.
        </p>
      </CardHeader>

      <CardContent className="space-y-5 min-w-0 max-w-full overflow-x-hidden">
        {/* ===== Quick presets ===== */}
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => {
            const active = dateFrom === p.from && dateTo === p.to;
            return (
              <Button
                key={p.key}
                size="sm"
                variant={active ? 'default' : 'outline'}
                onClick={() => applyPreset(p)}
              >
                {p.label}
              </Button>
            );
          })}
        </div>

        {/* ===== Filter controls ===== */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <FilterToggleButton
            open={filtersOpen}
            onToggle={() => setFiltersOpen((prev) => !prev)}
            className="w-full sm:w-auto"
          />
          <Button variant="outline" onClick={resetFilters} className="w-full sm:w-auto">
            Reset filtri
          </Button>
        </div>

        {filtersOpen && (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 min-w-0 max-w-full">
            <div className="grid gap-1 min-w-0">
              <Label>Dal</Label>
              <DatePicker value={dateFrom} onChange={handleDateFrom} className="min-w-0 w-full" placeholder="Seleziona data" />
            </div>
            <div className="grid gap-1 min-w-0">
              <Label>Al</Label>
              <DatePicker value={dateTo} onChange={handleDateTo} className="min-w-0 w-full" placeholder="Seleziona data" />
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
            <div className="grid gap-1 min-w-0">
              <Label>Confronto</Label>
              <Select value={compareMode} onValueChange={(v: CompareMode) => setCompareMode(v)}>
                <SelectTrigger className="min-w-0 w-full"><SelectValue placeholder="Seleziona" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="previous">Periodo precedente</SelectItem>
                  <SelectItem value="year">Stesso periodo, anno precedente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium leading-tight">Includi entrate</div>
            <p className="text-xs text-muted-foreground leading-tight">
              Somma anche le entrate registrate fuori dagli ordini nelle statistiche.
            </p>
          </div>
          <Switch
            id="include-incomes-switch"
            checked={includeIncomes}
            onCheckedChange={(v) => setIncludeIncomes(!!v)}
            aria-label="Includi entrate aggiuntive"
          />
        </div>

        {/* ===== Error state ===== */}
        {error && (
          <div className="flex flex-col gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300">
            <span className="min-w-0">{error}</span>
            <Button variant="outline" size="sm" onClick={load} className="w-full sm:w-auto shrink-0">
              Riprova
            </Button>
          </div>
        )}

        {/* ===== Initial skeleton ===== */}
        {initialLoading && (
          <div className="space-y-5">
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
            <Skeleton className="h-[320px] w-full" />
            <Skeleton className="h-[280px] w-full" />
          </div>
        )}

        {/* ===== Data ===== */}
        {raw && (
          <div
            className={cn('space-y-5', isRefreshing && 'opacity-60 pointer-events-none transition-opacity')}
            aria-busy={isRefreshing}
          >
            {/* Comparison period info */}
            <div className="text-xs text-muted-foreground">
              Periodo corrente: {fmtDateFullIT(raw.range.from)} – {fmtDateFullIT(raw.range.to)}
              <br />
              Confronto con: {fmtDateFullIT(raw.prevRange.start)} – {fmtDateFullIT(raw.prevRange.end)}
            </div>

            {/* KPIs grid */}
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
              <KpiTile label="Entrate" value={euro(totals.in)}>
                <DeltaBadge curr={totals.in} prev={prevTotals.in} goodWhen="up" />
              </KpiTile>
              <KpiTile label="Uscite" value={euro(totals.out)}>
                <DeltaBadge curr={totals.out} prev={prevTotals.out} goodWhen="down" />
              </KpiTile>
              <KpiTile
                label="Netto"
                value={euro(totals.net)}
                valueClass={netClass}
                sub={projection !== null ? `Proiezione fine periodo: ${euro(projection)}` : undefined}
              >
                <DeltaBadge curr={totals.net} prev={prevTotals.net} goodWhen="up" />
              </KpiTile>
              <KpiTile
                label="Margine"
                value={marginPct !== null ? `${marginPct.toFixed(1)}%` : '—'}
                valueClass={marginPct !== null && marginPct < 0 ? 'text-red-600 dark:text-red-400' : undefined}
                sub="Netto / Entrate"
              />
              <KpiTile label="Netto medio" value={euro(avgNet)} sub={granLabel} />
              <KpiTile
                label="Movimenti"
                value={movementsCount}
                sub={avgOrderTicket !== null ? `Ordine medio: ${euro(avgOrderTicket)}` : undefined}
              />
              <KpiTile
                label="Miglior periodo (Entrate)"
                value={bestIn ? `${labelFromISO(bestIn.label)} • ${euro(bestIn.value)}` : '—'}
                valueClass="text-sm font-medium"
              />
              <KpiTile
                label="Maggiori uscite"
                value={worstOut ? `${labelFromISO(worstOut.label)} • ${euro(worstOut.value)}` : '—'}
                valueClass="text-sm font-medium"
              />
            </div>

            {!hasData ? (
              <div className="rounded-lg border p-6 text-sm text-muted-foreground">
                Nessun dato disponibile per il periodo selezionato.
              </div>
            ) : (
              <>
                {/* ===== Main chart: In/Out bars + Net line + comparison overlay ===== */}
                <div className="space-y-3">
                  <div className="text-sm font-medium">Andamento Entrate/Uscite e Netto</div>
                  <div ref={barOuterRef} className="w-full overflow-x-auto rounded-md border">
                    <div className="h-[340px]" style={{ minWidth: Math.max(MIN_INNER, outerW || 0) }}>
                      <ChartContainer config={mainChartConfig} className="h-full w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={mainSeries}>
                            <CartesianGrid vertical={false} strokeDasharray="3 3" />
                            <XAxis
                              dataKey="label"
                              tickLine={false}
                              axisLine={false}
                              tickMargin={8}
                              minTickGap={24}
                              tickFormatter={labelFromISO}
                            />
                            <YAxis tickLine={false} axisLine={false} width={64} tickFormatter={euroCompact} />
                            <ChartTooltip
                              cursor={false}
                              content={
                                <ChartTooltipContent
                                  formatter={euroTooltipFormatter}
                                  labelFormatter={(lab) => labelFromISO(String(lab))}
                                />
                              }
                            />
                            <ChartLegend content={<ChartLegendContent />} />
                            <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeOpacity={0.4} strokeDasharray="4 4" />
                            <Bar dataKey="in" name={mainChartConfig.in.label} fill="var(--color-in)" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="out" name={mainChartConfig.out.label} fill="var(--color-out)" radius={[4, 4, 0, 0]} />
                            <Line
                              type="monotone"
                              dataKey="net"
                              name={mainChartConfig.net.label}
                              stroke="var(--color-net)"
                              strokeWidth={2}
                              dot={false}
                            />
                            {prevHasData && (
                              <Line
                                type="monotone"
                                dataKey="prevNet"
                                name={mainChartConfig.prevNet.label}
                                stroke="var(--color-prevNet)"
                                strokeWidth={1.5}
                                strokeDasharray="6 4"
                                strokeOpacity={0.7}
                                dot={false}
                                connectNulls={false}
                              />
                            )}
                          </ComposedChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                    </div>
                  </div>
                </div>

                {/* ===== Secondary chart: Cumulative Net ===== */}
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
                            <YAxis tickLine={false} axisLine={false} width={64} tickFormatter={euroCompact} />
                            <ChartTooltip
                              cursor={false}
                              content={
                                <ChartTooltipContent
                                  formatter={euroTooltipFormatter}
                                  labelFormatter={(lab) => labelFromISO(String(lab))}
                                />
                              }
                            />
                            <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeOpacity={0.4} strokeDasharray="4 4" />
                            <Area
                              dataKey="cnet"
                              name={cumChartConfig.cnet.label}
                              type="monotone"
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

                {/* ===== Category breakdowns ===== */}
                {(expenseCatRows.length > 0 || (includeIncomes && incomeCatRows.length > 0)) && (
                  <div className="space-y-3">
                    <div className="text-sm font-medium">Ripartizione per categoria</div>
                    <div className={cn('grid gap-3 min-w-0', includeIncomes && 'md:grid-cols-2')}>
                      <CategoryBreakdown title="Uscite per categoria" rows={expenseCatRows} />
                      {includeIncomes && <CategoryBreakdown title="Entrate extra per categoria" rows={incomeCatRows} />}
                    </div>
                  </div>
                )}

                {/* ===== Weekday distribution (only for daily) ===== */}
                {gran === 'daily' && (
                  <div className="space-y-3">
                    <div className="text-sm font-medium">Distribuzione per giorno della settimana (Entrate − Uscite)</div>
                    <div className="w-full overflow-x-auto rounded-md border">
                      <div className="h-[240px] min-w-[520px]">
                        <ChartContainer config={weekdayConfig} className="h-full w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={weekdayRows}>
                              <CartesianGrid vertical={false} strokeDasharray="3 3" />
                              <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} />
                              <YAxis tickLine={false} axisLine={false} width={64} tickFormatter={euroCompact} />
                              <ChartTooltip
                                cursor={false}
                                content={
                                  <ChartTooltipContent
                                    formatter={euroTooltipFormatter}
                                    labelFormatter={(lab) => `Giorno: ${String(lab)}`}
                                  />
                                }
                              />
                              <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeOpacity={0.4} strokeDasharray="4 4" />
                              <Bar dataKey="amount" name={weekdayConfig.amount.label} radius={4}>
                                {weekdayRows.map((r) => (
                                  <Cell
                                    key={r.day}
                                    fill={r.amount >= 0 ? 'var(--color-amount)' : 'var(--destructive)'}
                                  />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </ChartContainer>
                      </div>
                    </div>
                  </div>
                )}

                {/* ===== Detail (cards on mobile, table on desktop) ===== */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium">Dettaglio periodo</div>
                    <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1.5">
                      <FileDown className="h-4 w-4" aria-hidden="true" />
                      Esporta CSV
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Clicca su un periodo per vedere i movimenti nel dettaglio.
                  </p>
                  {/* Mobile cards */}
                  <div className="md:hidden space-y-2">
                    {series.map((r) => (
                      <button
                        key={r.label}
                        type="button"
                        onClick={() => setDrillLabel(r.label)}
                        className="w-full rounded-md border p-3 text-left transition-colors hover:bg-muted/50"
                      >
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
                      </button>
                    ))}
                    <div className="rounded-md border bg-muted/50 p-3">
                      <div className="font-medium">Totale</div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-sm font-medium">
                        <div className="text-muted-foreground">Entrate</div>
                        <div className="text-right tabular-nums">{euro(totals.in)}</div>
                        <div className="text-muted-foreground">Uscite</div>
                        <div className="text-right tabular-nums">{euro(totals.out)}</div>
                        <div className="text-muted-foreground">Netto</div>
                        <div className={['text-right tabular-nums', totals.net >= 0 ? 'text-emerald-600' : 'text-red-600'].join(' ')}>
                          {euro(totals.net)}
                        </div>
                      </div>
                    </div>
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
                          <tr
                            key={r.label}
                            className="border-t cursor-pointer transition-colors hover:bg-muted/50"
                            onClick={() => setDrillLabel(r.label)}
                          >
                            <td className="px-3 py-2">{labelFromISO(r.label)}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{euro(r.in)}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{euro(r.out)}</td>
                            <td className={['px-3 py-2 text-right tabular-nums', r.net >= 0 ? 'text-emerald-600' : 'text-red-600'].join(' ')}>
                              {euro(r.net)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t bg-muted/50 font-medium">
                          <td className="px-3 py-2">Totale</td>
                          <td className="px-3 py-2 text-right tabular-nums">{euro(totals.in)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{euro(totals.out)}</td>
                          <td className={['px-3 py-2 text-right tabular-nums', totals.net >= 0 ? 'text-emerald-600' : 'text-red-600'].join(' ')}>
                            {euro(totals.net)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>

      {/* ===== Drill-down dialog ===== */}
      <CashflowDrilldownDialog
        open={!!drillLabel && !!drillData}
        onOpenChange={(open) => {
          if (!open) setDrillLabel(null);
        }}
        title={drillTitle}
        showDates={gran !== 'daily'}
        entries={drillData?.entries ?? []}
        incomes={drillData?.incomes ?? []}
        expenses={drillData?.expenses ?? []}
      />
    </Card>
  );
}
