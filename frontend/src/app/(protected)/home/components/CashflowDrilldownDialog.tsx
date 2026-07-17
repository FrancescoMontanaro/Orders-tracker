'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { euro } from '../utils/currency';
import type { CashflowEntry, CashflowExpense, CashflowIncome } from '../types/cashflow';

/** Short date label (it-IT) from YYYY-MM-DD */
function fmtShortDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

type MovementRow = {
  key: string;
  date: string;
  description: string;
  amount: number;
};

function MovementsSection({
  title,
  rows,
  showDates,
  negative = false,
}: {
  title: string;
  rows: MovementRow[];
  showDates: boolean;
  /** Renders amounts in red (expenses) */
  negative?: boolean;
}) {
  if (!rows.length) return null;
  const total = rows.reduce((a, r) => a + r.amount, 0);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-medium">
          {title} <span className="text-muted-foreground font-normal">({rows.length})</span>
        </div>
        <div
          className={cn(
            'text-sm font-semibold tabular-nums',
            negative ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'
          )}
        >
          {negative ? '−' : '+'}{euro(total)}
        </div>
      </div>
      <div className="rounded-md border divide-y">
        {rows.map((r) => (
          <div key={r.key} className="flex items-center gap-3 px-3 py-2 text-sm min-w-0">
            <div className="min-w-0 flex-1">
              <div className="truncate">{r.description}</div>
              {showDates && <div className="text-xs text-muted-foreground">{fmtShortDate(r.date)}</div>}
            </div>
            <div className="shrink-0 tabular-nums">{euro(r.amount)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * CashflowDrilldownDialog
 * Shows every cash movement (order entries, extra incomes, expenses)
 * belonging to a single period selected from the Cashflow charts/table.
 */
export default function CashflowDrilldownDialog({
  open,
  onOpenChange,
  title,
  showDates,
  entries,
  incomes,
  expenses,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Human-readable period label (e.g. "15 lug 2026" or "lug 2026") */
  title: string;
  /** True when the period spans multiple days (monthly/yearly granularity) */
  showDates: boolean;
  entries: CashflowEntry[];
  incomes: CashflowIncome[];
  expenses: CashflowExpense[];
}) {
  const totalIn =
    entries.reduce((a, e) => a + e.amount, 0) + incomes.reduce((a, i) => a + i.amount, 0);
  const totalOut = expenses.reduce((a, x) => a + x.amount, 0);
  const net = totalIn - totalOut;
  const isEmpty = !entries.length && !incomes.length && !expenses.length;

  const entryRows: MovementRow[] = entries.map((e, idx) => ({
    key: `order-${e.order_id}-${idx}`,
    date: e.date,
    description: `Ordine #${e.order_id}`,
    amount: e.amount,
  }));
  const incomeRows: MovementRow[] = incomes.map((i) => ({
    key: `income-${i.id}`,
    date: i.date,
    description: i.note?.trim() || 'Entrata senza nota',
    amount: i.amount,
  }));
  const expenseRows: MovementRow[] = expenses.map((x) => ({
    key: `expense-${x.id}`,
    date: x.date,
    description: x.note?.trim() || 'Uscita senza nota',
    amount: x.amount,
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] flex flex-col overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="min-w-0 truncate">Movimenti — {title}</DialogTitle>
        </DialogHeader>

        {/* Period summary */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-md border p-2 text-center min-w-0">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Entrate</div>
            <div className="text-sm font-semibold tabular-nums truncate">{euro(totalIn)}</div>
          </div>
          <div className="rounded-md border p-2 text-center min-w-0">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Uscite</div>
            <div className="text-sm font-semibold tabular-nums truncate">{euro(totalOut)}</div>
          </div>
          <div className="rounded-md border p-2 text-center min-w-0">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Netto</div>
            <div
              className={cn(
                'text-sm font-semibold tabular-nums truncate',
                net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
              )}
            >
              {euro(net)}
            </div>
          </div>
        </div>

        {/* Movements list */}
        <div className="min-h-0 flex-1 overflow-y-auto space-y-4 pr-1">
          {isEmpty ? (
            <div className="rounded-md border p-4 text-sm text-muted-foreground">
              Nessun movimento registrato in questo periodo.
            </div>
          ) : (
            <>
              <MovementsSection title="Entrate da ordini" rows={entryRows} showDates={showDates} />
              <MovementsSection title="Entrate extra" rows={incomeRows} showDates={showDates} />
              <MovementsSection title="Uscite" rows={expenseRows} showDates={showDates} negative />
            </>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" className="w-full sm:w-auto">Chiudi</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
