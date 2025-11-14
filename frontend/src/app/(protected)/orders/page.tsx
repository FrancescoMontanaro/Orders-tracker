'use client';

import * as React from 'react';
import { api } from '@/lib/api-client';
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
import { DatePicker } from '@/components/ui/date-picker';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { cn } from '@/lib/utils';
import { X, ChevronDown } from 'lucide-react';
import { FilterToggleButton } from '@/components/ui/filter-toggle-button';

import { useOrders } from './hooks/useOrders';
import { useFixRadixInertLeak } from './hooks/useFixRadixInertLeak';
import { Order } from './types/order';
import { fmtDate } from './utils/date';
import { euro } from './utils/currency';

import { ItemsSummaryCell } from './components/ItemsSummaryCell';
import { StatusQuickEdit } from './components/StatusQuickEdit';
import { RowActions } from './components/RowActions';
import { AddOrderDialog } from './components/AddOrderDialog';
import { EditOrderDialog } from './components/EditOrderDialog';
import { ViewOrderDialog } from './components/ViewOrderDialog';

export default function OrdersPage() {
  useFixRadixInertLeak();

  const {
    rows, total, page, size, sorting, loading, error,
    searchName, status, dateFrom, dateTo,
    setPage, setSize, setSorting, setSearchName, setStatus, setDateFrom, setDateTo,
    refetch,
  } = useOrders();

  const [globalError, setGlobalError] = React.useState<string | null>(null);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});

  const [editOpen, setEditOpen] = React.useState(false);
  const [editOrder, setEditOrder] = React.useState<Order | null>(null);
  const [viewOpen, setViewOpen] = React.useState(false);
  const [viewOrder, setViewOrder] = React.useState<Order | null>(null);
  const [addOpen, setAddOpen] = React.useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = React.useState(false);

  const [confirmBulkOpen, setConfirmBulkOpen] = React.useState(false);
  const handleConfirmBulkOpenChange = React.useCallback((o: boolean) => {
    setConfirmBulkOpen(o);
    if (!o && typeof document !== 'undefined') {
      document.querySelectorAll('[inert]').forEach((el) => el.removeAttribute('inert'));
      (document.body as any).style.pointerEvents = '';
    }
  }, []);

  const onEdit = React.useCallback((o: Order) => {
    setEditOrder(o);
    setEditOpen(true);
  }, []);
  const onView = React.useCallback((o: Order) => {
    setViewOrder(o);
    setViewOpen(true);
  }, []);

  const cleanupInert = React.useCallback(() => {
    if (typeof document !== 'undefined') {
      document.querySelectorAll('[inert]').forEach((el) => el.removeAttribute('inert'));
      document.body.style.pointerEvents = '';
    }
  }, []);
  const handleEditOpenChange = React.useCallback((o: boolean) => { setEditOpen(o); if (!o) cleanupInert(); }, [cleanupInert]);
  const handleViewOpenChange = React.useCallback((o: boolean) => { setViewOpen(o); if (!o) cleanupInert(); }, [cleanupInert]);
  const handleAddOpenChange  = React.useCallback((o: boolean) => { setAddOpen(o);  if (!o) cleanupInert(); }, [cleanupInert]);

  const columns = React.useMemo<ColumnDef<Order>[]>(() => [
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
      accessorKey: 'delivery_date',
      header: 'Consegna',
      enableSorting: true,
      cell: ({ row }) => <span className="tabular-nums">{fmtDate(row.original.delivery_date)}</span>,
    },
    {
      accessorKey: 'customer_name',
      header: 'Cliente',
      enableSorting: true,
      cell: ({ row }) => <span className="break-words">{row.original.customer_name ?? `#${row.original.customer_id}`}</span>,
    },
    {
      id: 'items',
      header: 'Prodotti',
      enableSorting: false,
      cell: ({ row }) => <ItemsSummaryCell items={row.original.items ?? []} />,
    },
    {
      accessorKey: 'status',
      header: 'Stato',
      enableSorting: true,
      cell: ({ row }) => (
        <StatusQuickEdit
          orderId={row.original.id}
          value={(row.original.status ?? 'created')}
          onChanged={() => refetch()}
          onError={(msg) => setGlobalError(msg)}
        />
      ),
    },
    {
      accessorKey: 'total_amount',
      header: 'Totale',
      enableSorting: true,
      cell: ({ row }) => {
        const tot = row.original.total_amount ?? row.original.total_price ?? 0;
        return <span className="tabular-nums">{euro(tot)}</span>;
      },
    },
    {
      id: 'actions',
      header: 'Azioni',
      enableSorting: false,
      cell: ({ row }) => (
        <RowActions
          order={row.original}
          onView={onView}
          onEdit={onEdit}
          onChanged={() => refetch()}
          onError={(msg) => setGlobalError(msg)}
        />
      ),
      size: 48,
    },
  ], [refetch, onEdit, onView]);

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
    setSearchName('');
    setStatus('all');
    setDateFrom('');
    setDateTo('');
    setSorting([
      { id: 'status', desc: false },
      { id: 'delivery_date', desc: false },
    ]);
    setPage(1);
  }, [setSearchName, setStatus, setDateFrom, setDateTo, setSorting, setPage]);

  const [errorVisible, setErrorVisible] = React.useState(false);
  React.useEffect(() => { if (globalError || error) setErrorVisible(true); }, [globalError, error]);

  // Delete bulk
  async function bulkDeletePerform() {
    setGlobalError(null);
    if (!selectedIds.length) return;

    const errors: string[] = [];
    const results = await Promise.allSettled(selectedIds.map((id) => api.delete(`/orders/${id}`)));

    results.forEach((res, idx) => {
      if (res.status === 'rejected') {
        const e: any = res.reason;
        const detail = e?.response?.data?.detail ?? e?.response?.data?.message ?? e?.message ?? 'Errore sconosciuto';
        errors.push(`ID ${selectedIds[idx]}: ${String(detail)}`);
      }
    });

    if (errors.length) setGlobalError(`Alcune eliminazioni sono fallite:\n${errors.join('\n')}`);
    setRowSelection({});
    refetch();
  }

  // Bulk status (immediato via menu)
  const [bulkWorking, setBulkWorking] = React.useState(false);
  async function bulkSetStatus(next: 'created' | 'delivered') {
    if (!selectedIds.length) return;
    setBulkWorking(true);
    setGlobalError(null);

    const errors: string[] = [];
    const results = await Promise.allSettled(
      selectedIds.map((id) => api.patch(`/orders/${id}`, { status: next }))
    );

    results.forEach((res, idx) => {
      if (res.status === 'rejected') {
        const e: any = res.reason;
        const detail = e?.response?.data?.detail ?? e?.response?.data?.message ?? e?.message ?? 'Errore sconosciuto';
        errors.push(`ID ${selectedIds[idx]}: ${String(detail)}`);
      }
    });

    if (errors.length) setGlobalError(`Alcuni aggiornamenti di stato sono falliti:\n${errors.join('\n')}`);
    setRowSelection({});
    setBulkWorking(false);
    refetch();
  }

  // Mobile select all helpers
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
        {/* Titolo + azioni principali / bulk */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-lg">Ordini</CardTitle>

          {selectedIds.length > 0 ? (
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center min-w-0">
              {/* Menu azioni sui selezionati (imposta stato immediato) */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="w-full sm:w-auto inline-flex items-center justify-center">
                    Azioni sui selezionati ({selectedIds.length})
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[14rem]">
                  <DropdownMenuItem disabled={bulkWorking} onClick={() => bulkSetStatus('created')}>
                    Imposta: Da consegnare
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={bulkWorking} onClick={() => bulkSetStatus('delivered')}>
                    Imposta: Consegnato
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-red-600 focus:text-red-600"
                    onClick={() => handleConfirmBulkOpenChange(true)}
                  >
                    Elimina selezionati
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

            </div>
          ) : (
            <Button onClick={() => setAddOpen(true)}>+ Aggiungi ordine</Button>
          )}
        </div>

        {/* Error area */}
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

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <FilterToggleButton
            open={mobileFiltersOpen}
            onToggle={() => setMobileFiltersOpen((prev) => !prev)}
            className="w-full sm:w-auto"
          />
          <Button variant="outline" onClick={resetFilters} className="w-full sm:w-auto">
            Reset filtri
          </Button>
        </div>

        {/* ===== Desktop filters (md+) ===== */}
        <div className={cn(
          'hidden md:flex flex-wrap items-end gap-3 min-w-0',
          mobileFiltersOpen ? '' : 'md:hidden',
        )}
        >
          <div className="min-w-[200px]">
            <div className="grid gap-1">
              <Label>Consegna da</Label>
              <DatePicker value={dateFrom} onChange={setDateFrom} placeholder="Data da" />
            </div>
          </div>
          <div className="min-w-[200px]">
            <div className="grid gap-1">
              <Label>Consegna a</Label>
              <DatePicker value={dateTo} onChange={setDateTo} placeholder="Data a" />
            </div>
          </div>

          <div className="min-w-[200px]">
            <div className="grid gap-1">
              <Label>Stato</Label>
              <Select value={status} onValueChange={(v: 'all' | 'created' | 'delivered') => setStatus(v)}>
                <SelectTrigger className="min-w-0 w-full max-w-full">
                  <SelectValue placeholder="Tutti" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti</SelectItem>
                  <SelectItem value="created">Da consegnare</SelectItem>
                  <SelectItem value="delivered">Consegnato</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex-1 min-w-[240px]">
            <div className="grid gap-1">
              <Label>Ricerca</Label>
              <Input
                placeholder="Cerca per nome cliente…"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                className="min-w-0 w-full max-w-full"
              />
            </div>
          </div>
        </div>

        {/* ===== Mobile filters (<md) ===== */}
        <div className={cn('md:hidden space-y-3', mobileFiltersOpen ? 'block' : 'hidden')}>
          {/* Row 1: search */}
          <div className="grid gap-1 min-w-0">
            <Label>Ricerca</Label>
            <Input
              placeholder="Cerca per nome cliente…"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              className="min-w-0 w-full max-w-full"
            />
          </div>

          {/* Row 2: date range */}
          <div className="grid grid-cols-2 gap-3 min-w-0">
            <div className="grid gap-1 min-w-0">
              <Label>Consegna da</Label>
              <DatePicker value={dateFrom} onChange={setDateFrom} placeholder="Data da" />
            </div>
            <div className="grid gap-1 min-w-0">
              <Label>Consegna a</Label>
              <DatePicker value={dateTo} onChange={setDateTo} placeholder="Data a" />
            </div>
          </div>

          {/* Row 3: stato */}
          <div className="grid gap-1 min-w-0">
            <Label>Stato</Label>
            <Select value={status} onValueChange={(v: 'all' | 'created' | 'delivered') => setStatus(v)}>
              <SelectTrigger className="min-w-0 w-full max-w-full">
                <SelectValue placeholder="Tutti" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti</SelectItem>
                <SelectItem value="created">Da consegnare</SelectItem>
                <SelectItem value="delivered">Consegnato</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Divider */}
          <div className="h-px bg-border" />

          {/* Row 4: select all + sort */}
          <div className="grid grid-cols-2 gap-3 min-w-0 items-end">
            <label className="inline-flex items-center gap-2 text-sm min-w-0">
              <Checkbox
                checked={rows.length ? (mobileAllSelected || (mobileSomeSelected && 'indeterminate')) : false}
                onCheckedChange={(v) => mobileToggleSelectAll(!!v)}
                aria-label="Seleziona tutti (pagina)"
              />
              <span className="truncate">Seleziona tutti</span>
            </label>

            <div className="grid gap-1 min-w-0">
              <Label>Ordina per</Label>
              <Select
                value={
                  sorting?.[0]?.id === 'delivery_date' ? (sorting?.[0]?.desc ? 'date-desc' : 'date-asc')
                  : sorting?.[0]?.id === 'customer_name' ? (sorting?.[0]?.desc ? 'customer-desc' : 'customer-asc')
                  : sorting?.[0]?.id === 'status' ? (sorting?.[0]?.desc ? 'status-desc' : 'status-asc')
                  : sorting?.[0]?.id === 'total_amount' ? (sorting?.[0]?.desc ? 'total-desc' : 'total-asc')
                  : 'date-asc'
                }
                onValueChange={(v) => {
                  if (v === 'date-asc') setSorting([{ id: 'delivery_date', desc: false }]);
                  else if (v === 'date-desc') setSorting([{ id: 'delivery_date', desc: true }]);
                  else if (v === 'customer-asc') setSorting([{ id: 'customer_name', desc: false }]);
                  else if (v === 'customer-desc') setSorting([{ id: 'customer_name', desc: true }]);
                  else if (v === 'status-asc') setSorting([{ id: 'status', desc: false }]);
                  else if (v === 'status-desc') setSorting([{ id: 'status', desc: true }]);
                  else if (v === 'total-asc') setSorting([{ id: 'total_amount', desc: false }]);
                  else if (v === 'total-desc') setSorting([{ id: 'total_amount', desc: true }]);
                }}
              >
                <SelectTrigger className="min-w-0 w-full max-w-full">
                  <SelectValue placeholder="Ordina per" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date-asc">Consegna (↑)</SelectItem>
                  <SelectItem value="date-desc">Consegna (↓)</SelectItem>
                  <SelectItem value="customer-asc">Cliente (A→Z)</SelectItem>
                  <SelectItem value="customer-desc">Cliente (Z→A)</SelectItem>
                  <SelectItem value="status-asc">Stato (Da cons.→Cons.)</SelectItem>
                  <SelectItem value="status-desc">Stato (Cons.→Da cons.)</SelectItem>
                  <SelectItem value="total-asc">Totale (↑)</SelectItem>
                  <SelectItem value="total-desc">Totale (↓)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
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
            {/* Desktop table (md+) */}
            <div className="hidden md:block w-full overflow-x-auto rounded-md border">
              <div className="md:min-w-[64rem]">
                <Table className="compact-table">
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
                        {['', 'Consegna', 'Cliente', 'Prodotti', 'Stato', 'Totale', ''].map((h, i) => (
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
                          Nessun ordine trovato.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Mobile list (<md) */}
            <div className="md:hidden space-y-2">
              {rows.length ? (
                rows.map((r) => (
                  <div key={r.id} className="rounded-md border p-2.5">
                    {/* Top row: checkbox + customer + actions */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2 min-w-0">
                        <Checkbox
                          checked={!!(rowSelection as any)[String(r.id)]}
                          onCheckedChange={(v) =>
                            setRowSelection((prev) => ({ ...prev, [String(r.id)]: !!v }))
                          }
                          aria-label={`Seleziona ordine #${r.id}`}
                          className="mt-0.5 shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="font-medium break-words">
                            {r.customer_name ?? `#${r.customer_id}`}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0">
                        <RowActions
                          order={r}
                          onView={onView}
                          onEdit={(o) => onEdit(o)}
                          onChanged={() => refetch()}
                          onError={(msg) => setGlobalError(msg)}
                        />
                      </div>
                    </div>

                    {/* Meta row: Consegna + Totale (visibile, etichettato) */}
                    <div className="mt-1.5 grid grid-cols-2 gap-2 text-sm">
                      <div className="text-muted-foreground">
                        <span className="block">Consegna</span>
                        <span className="tabular-nums">{fmtDate(r.delivery_date)}</span>
                      </div>
                      <div className="text-right">
                        <span className="block text-muted-foreground">Totale</span>
                        <span className="font-semibold tabular-nums">{euro(r.total_amount ?? r.total_price ?? 0)}</span>
                      </div>
                    </div>

                    {/* Items summary */}
                    <div className="mt-1.5">
                      <ItemsSummaryCell items={r.items ?? []} />
                    </div>

                    {/* Status quick edit (a tutta larghezza) */}
                    <div className="mt-1.5">
                      <StatusQuickEdit
                        orderId={r.id}
                        value={(r.status ?? 'created')}
                        onChanged={() => refetch()}
                        onError={(msg) => setGlobalError(msg)}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-md border p-4 text-center text-sm text-muted-foreground">
                  Nessun ordine trovato.
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

      {/* Dialogs */}
      <EditOrderDialog
        open={editOpen}
        onOpenChange={handleEditOpenChange}
        order={editOrder}
        onSaved={() => { setGlobalError(null); refetch(); }}
        onDeleted={() => { setGlobalError(null); refetch(); }}
        onError={(msg) => setGlobalError(msg)}
      />
      <ViewOrderDialog
        open={viewOpen}
        onOpenChange={handleViewOpenChange}
        order={viewOrder}
        onRequestEdit={onEdit}
      />
      <AddOrderDialog
        open={addOpen}
        onOpenChange={handleAddOpenChange}
        onCreated={() => { setGlobalError(null); refetch(); }}
        onError={(msg) => setGlobalError(msg)}
      />

      {/* Bulk delete confirm */}
      <BulkDeleteConfirm
        open={confirmBulkOpen}
        onOpenChange={handleConfirmBulkOpenChange}
        count={selectedIds.length}
        onConfirm={bulkDeletePerform}
      />
    </Card>
  );
}

/** Local-only bulk delete confirm */
function BulkDeleteConfirm({
  open, onOpenChange, count, onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  count: number;
  onConfirm: () => Promise<void> | void;
}) {
  const {
    AlertDialog,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogFooter,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogCancel,
    AlertDialogAction,
  } = require('@/components/ui/alert-dialog');

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Eliminare {count} ordine/i?</AlertDialogTitle>
          <AlertDialogDescription>
            Questa azione non può essere annullata.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annulla</AlertDialogCancel>
          <AlertDialogAction
            onClick={async () => {
              onOpenChange(false);
              await onConfirm();
            }}
          >
            Conferma
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
