'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api-client';
import { DatePicker } from '@/components/ui/date-picker';
import { useFixRadixInertLeak } from './hooks/useFixRadixInertLeak';
import { useExpenses } from './hooks/useExpenses';
import { euro } from './utils/currency';
import { fmtDate } from './utils/date';

import {
  ColumnDef,
  RowSelectionState,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { X } from 'lucide-react';

import { PaginationControls } from '@/components/ui/pagination-controls';
import { RowActions } from './components/RowActions'; // versione per Expense
import { EditExpenseDialog } from './components/EditExpenseDialog';
import { AddExpenseDialog } from './components/AddExpenseDialog';

import type { Expense } from './types/expense';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';

/**
 * Expenses page (responsive)
 * - Desktop: classic table with selection/sort.
 * - Mobile: card list + mobile toolbar (select all + sort).
 * - Prevent horizontal overflow via min-w-0, wrappers and safe truncation.
 */
export default function ExpensesPage() {
  useFixRadixInertLeak();

  const {
    rows, total, page, size, sorting, loading, error,
    noteQuery, amountMin, amountMax, dateFrom, dateTo,
    setPage, setSize, setSorting, setNoteQuery, setAmountMin, setAmountMax, setDateFrom, setDateTo,
    refetch,
  } = useExpenses();

  const [globalError, setGlobalError] = React.useState<string | null>(null);

  // Row selection (used for bulk delete)
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});

  // Edit & Add dialogs
  const [editOpen, setEditOpen] = React.useState(false);
  const [editExpense, setEditExpense] = React.useState<Expense | null>(null);
  const [addOpen, setAddOpen] = React.useState(false);

  // Bulk delete confirm + inert cleanup
  const [confirmBulkOpen, setConfirmBulkOpen] = React.useState(false);
  const handleConfirmBulkOpenChange = React.useCallback((o: boolean) => {
    setConfirmBulkOpen(o);
    if (!o && typeof document !== 'undefined') {
      document.querySelectorAll('[inert]').forEach((el) => el.removeAttribute('inert'));
      (document.body as any).style.pointerEvents = '';
    }
  }, []);

  const onEdit = (e: Expense) => {
    setEditExpense(e);
    setEditOpen(true);
  };

  // Cleanup after dialogs close
  const cleanupInert = React.useCallback(() => {
    if (typeof document !== 'undefined') {
      document.querySelectorAll('[inert]').forEach((el) => el.removeAttribute('inert'));
      document.body.style.pointerEvents = '';
    }
  }, []);
  const handleEditOpenChange = React.useCallback((o: boolean) => {
    setEditOpen(o);
    if (!o) cleanupInert();
  }, [cleanupInert]);
  const handleAddOpenChange = React.useCallback((o: boolean) => {
    setAddOpen(o);
    if (!o) cleanupInert();
  }, [cleanupInert]);

  // Desktop columns
  const columns = React.useMemo<ColumnDef<Expense>[]>(() => [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && 'indeterminate')}
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
          aria-label="Seleziona tutte"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(!!v)}
          aria-label="Seleziona riga"
        />
      ),
      enableSorting: false,
      enableHiding: false,
      size: 32,
    },
    {
      accessorKey: 'timestamp',
      header: 'Data',
      enableSorting: true,
      cell: ({ row }) => <span className="tabular-nums">{fmtDate(row.original.timestamp)}</span>,
    },
    {
      accessorKey: 'amount',
      header: 'Importo',
      enableSorting: true,
      cell: ({ row }) => <span className="tabular-nums">{euro(row.original.amount)}</span>,
    },
    {
      accessorKey: 'note',
      header: 'Nota',
      enableSorting: false,
      cell: ({ row }) => {
        const note = row.original.note || '-';
        return (
          <div
            title={typeof note === 'string' ? note : undefined}
            className="max-w-[28ch] sm:max-w-[48ch] whitespace-pre-wrap break-words line-clamp-2"
          >
            {note}
          </div>
        );
      },
    },
    {
      id: 'actions',
      header: 'Azioni',
      enableSorting: false,
      cell: ({ row }) => (
        <RowActions
          expense={row.original}
          onEdit={onEdit}
          onChanged={() => refetch()}
          onError={(msg) => setGlobalError(msg)}
        />
      ),
      size: 48,
    },
  ], [refetch]);

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, rowSelection },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualPagination: true,
    enableRowSelection: true,
    getRowId: (row) => String(row.id),
  });

  const selectedIds = React.useMemo(
    () => Object.entries(rowSelection).filter(([, v]) => !!v).map(([k]) => Number(k)),
    [rowSelection]
  );

  const resetFilters = React.useCallback(() => {
    setNoteQuery('');
    setAmountMin('');
    setAmountMax('');
    setDateFrom('');
    setDateTo('');
    setSorting([{ id: 'timestamp', desc: true }]);
    setPage(1);
  }, [setNoteQuery, setAmountMin, setAmountMax, setDateFrom, setDateTo, setSorting, setPage]);

  const [errorVisible, setErrorVisible] = React.useState(false);
  React.useEffect(() => {
    if (globalError || error) setErrorVisible(true);
  }, [globalError, error]);

  // Bulk delete
  async function bulkDeletePerform() {
    setGlobalError(null);
    if (!selectedIds.length) return;

    const errors: string[] = [];
    const results = await Promise.allSettled(
      selectedIds.map((id) => api.delete(`/expenses/${id}`))
    );

    results.forEach((res, idx) => {
      if (res.status === 'rejected') {
        const e: any = res.reason;
        const detail =
          e?.response?.data?.detail ??
          e?.response?.data?.message ??
          e?.message ??
          'Errore sconosciuto';
        errors.push(`ID ${selectedIds[idx]}: ${String(detail)}`);
      }
    });

    if (errors.length) {
      setGlobalError(`Alcune eliminazioni sono fallite:\n${errors.join('\n')}`);
    } else {
      setGlobalError(null);
    }
    setRowSelection({});
    refetch();
  }

  // Mobile helpers for "select all" (current page)
  const mobilePageRowIds = React.useMemo(() => rows.map((r) => String(r.id)), [rows]);
  const mobileAllSelected =
    rows.length > 0 && rows.every((r) => !!(rowSelection as any)[String(r.id)]);
  const mobileSomeSelected =
    rows.length > 0 && !mobileAllSelected && rows.some((r) => !!(rowSelection as any)[String(r.id)]);
  function mobileToggleSelectAll(next: boolean) {
    setRowSelection((prev) => {
      const nextSel: RowSelectionState = { ...prev };
      if (next) mobilePageRowIds.forEach((id) => { nextSel[id] = true; });
      else mobilePageRowIds.forEach((id) => { delete nextSel[id]; });
      return nextSel;
    });
  }

  return (
    <Card className="max-w-full">
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-lg">Spese</CardTitle>

          {selectedIds.length > 0 ? (
            <Button variant="destructive" onClick={() => setConfirmBulkOpen(true)}>
              Elimina selezionate ({selectedIds.length})
            </Button>
          ) : (
            <Button onClick={() => setAddOpen(true)}>+ Aggiungi spesa</Button>
          )}
        </div>

        {/* Global errors */}
        {errorVisible && (globalError || error) && (
          <div className="relative rounded-md border border-red-200 bg-red-50 p-3 pr-10 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300 whitespace-pre-line">
            <button
              type="button"
              aria-label="Chiudi errore"
              className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded hover:bg-red-100/60 dark:hover:bg-red-900/40"
              onClick={() => setErrorVisible(false)}
            >
              <X className="h-4 w-4" />
            </button>
            {globalError || error}
          </div>
        )}

        {/* ===== Desktop filters (md+) ===== */}
        <div className="hidden md:flex flex-wrap items-end gap-3 min-w-0">
          {/* Date range */}
          <div className="min-w-[160px]">
            <div className="grid gap-1">
              <Label>Da</Label>
              <DatePicker
                value={dateFrom}
                onChange={setDateFrom}
                placeholder="Data da"
              />
            </div>
          </div>
          <div className="min-w-[160px]">
            <div className="grid gap-1">
              <Label>A</Label>
              <DatePicker
                value={dateTo}
                onChange={setDateTo}
                placeholder="Data a"
              />
            </div>
          </div>

          {/* Amount min/max */}
          <div className="min-w-[140px]">
            <div className="grid gap-1">
              <Label>Importo min</Label>
              <Input
                type="number"
                step="0.01"
                value={amountMin}
                placeholder="0.00"
                onChange={(e) => setAmountMin(e.target.value)}
              />
            </div>
          </div>
          <div className="min-w-[140px]">
            <div className="grid gap-1">
              <Label>Importo max</Label>
              <Input
                type="number"
                step="0.01"
                value={amountMax}
                placeholder="0.00"
                onChange={(e) => setAmountMax(e.target.value)}
              />
            </div>
          </div>

          {/* Note search */}
          <div className="flex-1 min-w-[220px]">
            <div className="grid gap-1">
              <Label>Nota</Label>
              <Input
                placeholder="Cerca nella nota…"
                value={noteQuery}
                onChange={(e) => setNoteQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Reset */}
          <div className="min-w-[160px]">
            <div className="grid gap-1">
              <Label className="opacity-0 select-none">Reset</Label>
              <Button variant="outline" onClick={resetFilters} className="w-full sm:w-auto">
                Reset filtri
              </Button>
            </div>
          </div>
        </div>

        {/* ===== Mobile filters (<md) ===== */}
        <div className="md:hidden space-y-3">
          {/* Row 1: note search full width */}
          <div className="grid gap-1 min-w-0">
            <Label>Nota</Label>
            <Input
              placeholder="Cerca nella nota…"
              value={noteQuery}
              onChange={(e) => setNoteQuery(e.target.value)}
              className="min-w-0 w-full max-w-full"
            />
          </div>

          {/* Row 2: date range (2 cols) */}
          <div className="grid grid-cols-2 gap-3 min-w-0">
            <div className="grid gap-1 min-w-0">
              <Label>Da</Label>
              <DatePicker value={dateFrom} onChange={setDateFrom} placeholder="Data da" />
            </div>
            <div className="grid gap-1 min-w-0">
              <Label>A</Label>
              <DatePicker value={dateTo} onChange={setDateTo} placeholder="Data a" />
            </div>
          </div>

          {/* Row 3: amount min/max (2 cols) */}
          <div className="grid grid-cols-2 gap-3 min-w-0">
            <div className="grid gap-1 min-w-0">
              <Label>Importo min</Label>
              <Input
                type="number"
                step="0.01"
                value={amountMin}
                placeholder="0.00"
                onChange={(e) => setAmountMin(e.target.value)}
                className="min-w-0 w-full max-w-full"
              />
            </div>
            <div className="grid gap-1 min-w-0">
              <Label>Importo max</Label>
              <Input
                type="number"
                step="0.01"
                value={amountMax}
                placeholder="0.00"
                onChange={(e) => setAmountMax(e.target.value)}
                className="min-w-0 w-full max-w-full"
              />
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-border" />

          {/* Row 4: select all + sort + reset */}
          <div className="grid grid-cols-2 gap-3 min-w-0 items-end">
            {/* Select all current page */}
            <label className="inline-flex items-center gap-2 text-sm min-w-0">
              <Checkbox
                checked={rows.length ? (mobileAllSelected || (mobileSomeSelected && 'indeterminate')) : false}
                onCheckedChange={(v) => mobileToggleSelectAll(!!v)}
                aria-label="Seleziona tutti (pagina)"
              />
              <span className="truncate">Seleziona tutti</span>
            </label>

            {/* Sort select */}
            <div className="grid gap-1 min-w-0">
              <Label>Ordina per</Label>
              <Select
                value={
                  sorting?.[0]?.id === 'timestamp'
                    ? sorting?.[0]?.desc ? 'date-desc' : 'date-asc'
                    : sorting?.[0]?.id === 'amount'
                    ? sorting?.[0]?.desc ? 'amount-desc' : 'amount-asc'
                    : 'date-desc'
                }
                onValueChange={(v) => {
                  if (v === 'date-asc') setSorting([{ id: 'timestamp', desc: false }]);
                  else if (v === 'date-desc') setSorting([{ id: 'timestamp', desc: true }]);
                  else if (v === 'amount-asc') setSorting([{ id: 'amount', desc: false }]);
                  else if (v === 'amount-desc') setSorting([{ id: 'amount', desc: true }]);
                }}
              >
                <SelectTrigger className="min-w-0 w-full max-w-full">
                  <SelectValue placeholder="Ordina per" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date-desc">Data (nuove → vecchie)</SelectItem>
                  <SelectItem value="date-asc">Data (vecchie → nuove)</SelectItem>
                  <SelectItem value="amount-desc">Importo (alto → basso)</SelectItem>
                  <SelectItem value="amount-asc">Importo (basso → alto)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Reset button full width */}
          <Button variant="outline" onClick={resetFilters} className="w-full">
            Reset filtri
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 overflow-x-hidden">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-5/6" />
            <Skeleton className="h-10 w-2/3" />
          </div>
        ) : (
          <>
            {/* Desktop table (md+): classic table; inner min-width only on md+ */}
            <div className="hidden md:block w-full overflow-x-auto rounded-md border">
              <div className="md:min-w-[52rem]">
                <Table>
                  <TableHeader>
                    {rows.length > 0 ? (
                      table.getHeaderGroups().map((hg) => (
                        <TableRow key={hg.id}>
                          {hg.headers.map((header) => {
                            const canSort = header.column.getCanSort?.() ?? false;
                            const sorted = header.column.getIsSorted?.();
                            return (
                              <TableHead
                                key={header.id}
                                onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                                className={cn(canSort && 'cursor-pointer select-none')}
                                style={{ width: (header.column.columnDef as any).size }}
                              >
                                <div className="flex items-center gap-1">
                                  {flexRender(header.column.columnDef.header, header.getContext())}
                                  {sorted === 'asc' ? <span>▲</span> : sorted === 'desc' ? <span>▼</span> : null}
                                </div>
                              </TableHead>
                            );
                          })}
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        {['', 'Data', 'Importo', 'Nota', ''].map((h, i) => (
                          <TableHead key={i}>{h}</TableHead>
                        ))}
                      </TableRow>
                    )}
                  </TableHeader>

                  <TableBody>
                    {rows.length ? (
                      table.getRowModel().rows.map((row) => (
                        <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
                          {row.getVisibleCells().map((cell) => (
                            <TableCell key={cell.id}>
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={table.getAllColumns().length} className="h-24 text-center text-sm text-muted-foreground">
                          Nessuna spesa trovata.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Mobile list (<md): card layout to avoid horizontal overflow */}
            <div className="md:hidden space-y-2">
              {rows.length ? (
                rows.map((r) => (
                  <div key={r.id} className="rounded-md border p-3">
                    {/* Top row: checkbox + date + actions */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2 min-w-0">
                        <Checkbox
                          checked={!!(rowSelection as any)[String(r.id)]}
                          onCheckedChange={(v) =>
                            setRowSelection((prev) => ({ ...prev, [String(r.id)]: !!v }))
                          }
                          aria-label={`Seleziona spesa ${r.id}`}
                          className="mt-0.5 shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="font-medium tabular-nums">{fmtDate(r.timestamp)}</div>
                          <div className="text-sm tabular-nums">{euro(r.amount)}</div>
                        </div>
                      </div>

                      <div className="shrink-0">
                        <RowActions
                          expense={r}
                          onEdit={(e) => onEdit(e)}
                          onChanged={() => refetch()}
                          onError={(msg) => setGlobalError(msg)}
                        />
                      </div>
                    </div>

                    {/* Note */}
                    <div className="mt-2 text-sm text-muted-foreground break-words whitespace-pre-wrap">
                      {r.note || '—'}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-md border p-4 text-center text-sm text-muted-foreground">
                  Nessuna spesa trovata.
                </div>
              )}
            </div>

            <PaginationControls
              page={page}
              size={size}
              total={total}
              onPrev={() => setPage((p) => Math.max(1, p - 1))}
              onNext={() => setPage((p) => p + 1)}
              onSizeChange={(s) => { setSize(s); setPage(1); setRowSelection({}); }}
              disabled={loading}
            />
          </>
        )}
      </CardContent>

      {/* Centralized dialogs */}
      <EditExpenseDialog
        open={editOpen}
        onOpenChange={handleEditOpenChange}
        expense={editExpense}
        onSaved={() => { setGlobalError(null); refetch(); }}
        onDeleted={() => { setGlobalError(null); refetch(); }}
        onError={(msg) => setGlobalError(msg)}
      />

      <AddExpenseDialog
        open={addOpen}
        onOpenChange={handleAddOpenChange}
        onCreated={() => { setGlobalError(null); refetch(); }}
        onError={(msg) => setGlobalError(msg)}
      />

      {/* Bulk delete confirm */}
      <AlertDialog open={confirmBulkOpen} onOpenChange={handleConfirmBulkOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare {selectedIds.length} spesa/e?</AlertDialogTitle>
            <AlertDialogDescription>
              Questa azione non può essere annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                handleConfirmBulkOpenChange(false);
                await bulkDeletePerform();
              }}
            >
              Conferma
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}