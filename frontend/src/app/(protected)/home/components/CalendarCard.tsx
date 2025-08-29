'use client';

import * as React from 'react';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

import AddOrderDialog from './AddOrderDialog';
import DayOrdersDialog, { type DayOrdersGrouped } from './DayOrdersDialog';

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

/** Keep the original delivered check */
function isDelivered(status?: string) {
  return String(status).toLowerCase() === 'delivered';
}

/** Group a day view by customer (delivered state and list of items per customer) */
function groupByCustomer(
  day?: DailySummaryDay
): DayOrdersGrouped {
  if (!day) return [];
  const map = new Map<
    number,
    {
      customer_id: number;
      customer_name: string;
      items: Array<{ product_id: number; product_name: string; quantity: number; unit: string }>;
      deliveredCount: number;
      totalCount: number;
    }
  >();

  for (const p of day.products || []) {
    for (const c of p.customers || []) {
      const entry =
        map.get(c.customer_id) ||
        {
          customer_id: c.customer_id,
          customer_name: c.customer_name,
          items: [],
          deliveredCount: 0,
          totalCount: 0,
        };
      entry.items.push({
        product_id: p.product_id,
        product_name: p.product_name,
        quantity: Number(c.quantity || 0),
        unit: p.product_unit,
      });
      entry.totalCount += 1;
      if (isDelivered(c.order_status)) entry.deliveredCount += 1;
      map.set(c.customer_id, entry);
    }
  }

  return Array.from(map.values())
    .map((e) => ({
      customer_id: e.customer_id,
      customer_name: e.customer_name,
      delivered: e.totalCount > 0 && e.deliveredCount === e.totalCount,
      items: e.items,
    }))
    .sort((a, b) => Number(a.delivered) - Number(b.delivered)); // pending first
}

export default function CalendarCard() {
  const [month, setMonth] = React.useState<Date>(firstDayOfMonth(new Date()));
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [days, setDays] = React.useState<Record<string, DailySummaryDay>>({});
  const [addOpen, setAddOpen] = React.useState(false);
  const [selectedDate, setSelectedDate] = React.useState<string | undefined>(undefined);

  // NEW: day-orders list dialog state
  const [listOpen, setListOpen] = React.useState(false);

  // Scroll containers: desktop grid (horizontally scrollable) and mobile list
  const desktopRef = React.useRef<HTMLDivElement>(null);
  const mobileRef = React.useRef<HTMLDivElement>(null);

  // Guard: prevents repeating auto-scroll unless explicitly requested
  const didScrollRef = React.useRef(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const startISO = toISO(firstDayOfMonth(month));
      const endISO = toISO(lastDayOfMonth(month));
      const res = await api.post<SuccessResponse<DailySummaryDay[]>>('/widgets/daily-summary', {
        start_date: startISO,
        end_date: endISO,
      });
      const arr = (res.data as any)?.data ?? res.data;
      const map: Record<string, DailySummaryDay> = {};
      (arr as DailySummaryDay[]).forEach((day) => {
        if (day?.date) map[day.date] = day;
      });
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

  /** CHANGED: Click opens the day-orders list first (not the Add dialog) */
  function onDayClick(date: Date) {
    const iso = toISO(date);
    setSelectedDate(iso);
    setListOpen(true);
  }

  function gotoPrev() {
    setMonth((m) => addMonths(m, -1));
  }
  function gotoNext() {
    setMonth((m) => addMonths(m, +1));
  }
  function gotoToday() {
    // Move to current month and re-enable auto scroll when data is ready
    setMonth(firstDayOfMonth(new Date()));
    didScrollRef.current = false;

    // reset containers scroll before the new month renders
    desktopRef.current?.scrollTo({ left: 0, top: 0, behavior: 'auto' });
    mobileRef.current?.scrollTo({ left: 0, top: 0, behavior: 'auto' });
  }

  // Helper: try scrolling to today's element inside visible containers
  const attemptScrollToToday = React.useCallback(() => {
    let scrolled = false;
    const containers = [desktopRef.current, mobileRef.current].filter(Boolean) as HTMLElement[];

    for (const root of containers) {
      // skip hidden (e.g., inactive tab)
      const isVisible = root && root.offsetParent !== null && root.getClientRects().length > 0;
      if (!isVisible) continue;

      const el = root.querySelector<HTMLElement>('[data-today="true"]');
      if (!el) continue;

      // --- Horizontal centering for desktop grid (root is horizontally scrollable) ---
      if (root.scrollWidth > root.clientWidth) {
        const targetLeft = el.offsetLeft - root.clientWidth / 2 + el.clientWidth / 2;
        const clampedLeft = Math.max(0, Math.min(targetLeft, root.scrollWidth - root.clientWidth));
        root.scrollTo({ left: clampedLeft, behavior: 'smooth' });
        scrolled = true;
      }

      // --- Vertical positioning ---
      const hasVerticalScroll = root.scrollHeight > root.clientHeight;
      const elRect = el.getBoundingClientRect();

      if (hasVerticalScroll) {
        // Scroll the container itself (if it actually scrolls vertically)
        const elTopInParent = el.offsetTop - root.offsetTop;
        const targetTop = elTopInParent - root.clientHeight / 2 + el.clientHeight / 2;
        const clampedTop = Math.max(0, Math.min(targetTop, root.scrollHeight - root.clientHeight));
        root.scrollTo({ top: clampedTop, behavior: 'smooth' });
        scrolled = true;
      } else {
        // Container doesn't scroll vertically (mobile list → page scroll)
        const top = window.scrollY + elRect.top - window.innerHeight / 2 + elRect.height / 2;
        window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
        scrolled = true;
      }
    }

    if (scrolled) didScrollRef.current = true;
    return scrolled;
  }, []);

  // Auto-scroll once when data is ready (on open) – robust retry while tab becomes visible
  React.useEffect(() => {
    if (loading || didScrollRef.current) return;

    let attempts = 14; // ~700ms total
    let timer: number | undefined;

    const tick = () => {
      const ok = attemptScrollToToday();
      if (ok || --attempts <= 0) return;
      timer = window.setTimeout(tick, 50);
    };

    tick();
    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [loading, days, month, attemptScrollToToday]);

  // Also observe container size changes (tab activation) and try once more if not yet scrolled
  React.useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return;

    const obs = new ResizeObserver(() => {
      if (!loading && !didScrollRef.current) {
        attemptScrollToToday();
      }
    });

    if (desktopRef.current) obs.observe(desktopRef.current);
    if (mobileRef.current) obs.observe(mobileRef.current);

    return () => obs.disconnect();
  }, [loading, attemptScrollToToday]);

  return (
    <>
      <Card>
        <CardHeader className="space-y-3">
          {/* Header: keep desktop layout, make controls wrap nicely on small screens */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-lg">Calendario ordini</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={gotoToday}>
                Oggi
              </Button>
              <Button variant="outline" onClick={gotoPrev} aria-label="Mese precedente">
                ‹
              </Button>
              {/* Month label: allow shrinking on small screens */}
              <div className="min-w-[10ch] text-center font-medium sm:min-w-[12ch]">
                {itMonthLabel(month)}
              </div>
              <Button variant="outline" onClick={gotoNext} aria-label="Mese successivo">
                ›
              </Button>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
              <span>Consegnato</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
              <span>Da consegnare</span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-5 w-1/4" />
              <Skeleton className="h-[360px] w-full" />
            </div>
          ) : error ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </div>
          ) : (
            <>
              {/* Desktop calendar grid (unchanged) */}
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
                      const deliveredCount = grouped.filter((g) => g.delivered).length;
                      const pendingCount = grouped.length - deliveredCount;

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
                            'scroll-mx-8', // margin for nicer centering when scrolled horizontally
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
                              {grouped.map((g) => (
                                <li key={g.customer_id} className="leading-snug">
                                  <span
                                    className={cn(
                                      'inline-block h-2 w-2 rounded-full mr-1 align-middle',
                                      g.delivered ? 'bg-emerald-500' : 'bg-amber-500'
                                    )}
                                  />
                                  <span className="font-medium">{g.customer_name}</span>{' '}
                                  <span className="text-muted-foreground">
                                    {g.items.map((it, i) => (
                                      <span key={i}>
                                        {it.product_name} × {it.quantity}
                                        {it.unit ? ` ${it.unit}` : ''}
                                        {i < g.items.length - 1 ? ', ' : ''}
                                      </span>
                                    ))}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <div className="text-xs text-muted-foreground/70">Nessun ordine</div>
                          )}

                          <div className="pointer-events-none absolute inset-x-2 bottom-2 hidden justify-end group-hover:flex">
                            
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Mobile list view (single column, tap-friendly) */}
              <div ref={mobileRef} className="md:hidden space-y-2">
                {gridCells.map((d, idx) => {
                  const inCurrentMonth = d.getMonth() === month.getMonth();
                  const iso = toISO(d);
                  const grouped = groupByCustomer(days[iso]);
                  const today = isToday(d);
                  const deliveredCount = grouped.filter((g) => g.delivered).length;
                  const pendingCount = grouped.length - deliveredCount;

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => onDayClick(d)}
                      data-today={today ? 'true' : undefined}
                      data-iso={iso}
                      className={cn(
                        'w-full rounded-lg border p-3 text-left transition-colors',
                        'hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2',
                        inCurrentMonth ? 'bg-card' : 'bg-muted/30 text-muted-foreground',
                        today && 'ring-1 ring-inset ring-primary/40 bg-primary/5'
                      )}
                    >
                      {/* Row: date chip + counters (non-wrapping) */}
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

                      {/* Customers summary: compact, scrollable if long */}
                      {grouped.length ? (
                        <ul className="space-y-1 text-xs max-h-32 overflow-y-auto pr-1">
                          {grouped.map((g) => (
                            <li key={g.customer_id} className="leading-snug">
                              <span
                                className={cn(
                                  'inline-block h-2 w-2 rounded-full mr-1 align-middle',
                                  g.delivered ? 'bg-emerald-500' : 'bg-amber-500'
                                )}
                              />
                              <span className="font-medium">{g.customer_name}</span>{' '}
                              <span className="text-muted-foreground">
                                {g.items.map((it, i) => (
                                  <span key={i}>
                                    {it.product_name} × {it.quantity}
                                    {it.unit ? ` ${it.unit}` : ''}
                                    {i < g.items.length - 1 ? ', ' : ''}
                                  </span>
                                ))}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="text-xs text-muted-foreground/70">Nessun ordine</div>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Day orders list dialog: opens first; from there user can add a new order */}
      <DayOrdersDialog
        open={listOpen}
        onOpenChange={setListOpen}
        dateISO={selectedDate}
        customerGroups={selectedDate ? groupByCustomer(days[selectedDate]) : []}
        onNewOrder={() => {
          setAddOpen(true);
        }}
      />

      {/* Existing Add dialog (unchanged). defaultDate keeps the chosen day */}
      <AddOrderDialog
        open={addOpen}
        onOpenChange={(o) => setAddOpen(o)}
        onCreated={() => {
          load();
        }}
        defaultDate={selectedDate}
      />
    </>
  );
}