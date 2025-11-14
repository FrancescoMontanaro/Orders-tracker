'use client';

import * as React from 'react';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import {
  ColumnDef,
  RowSelectionState,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';

import { useFixRadixInertLeak } from './hooks/useFixRadixInertLeak';
import { useLots } from './hooks/useLots';
import type { Lot } from './types/lot';
import { formatLotDate } from './utils/date';
import { LotItemsCell } from './components/LotItemsCell';
import { RowActions } from './components/RowActions';
import { AddLotDialog } from './components/AddLotDialog';
import { EditLotDialog } from './components/EditLotDialog';
import { ViewLotDialog } from './components/ViewLotDialog';

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { X, MapPin } from 'lucide-react';

/**
 * Lots management page.
 * Reuses the same layout/UX conventions adopted across other protected sections.
 */
export default function LotsPage() {
  useFixRadixInertLeak();

  const {
    rows,
    total,
    page,
    size,
    sorting,
    loading,
    error,
    searchTerm,
    locationTerm,
    dateFrom,
    dateTo,
    setPage,
    setSize,
    setSorting,
    setSearchTerm,
    setLocationTerm,
    setDateFrom,
    setDateTo,
    refetch,
  } = useLots();

  const [globalError, setGlobalError] = React.useState<string | null>(null);
  const [errorVisible, setErrorVisible] = React.useState(false);
  React.useEffect(() => {
    if (globalError || error) setErrorVisible(true);
  }, [globalError, error]);

  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});

  const [addOpen, setAddOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [editLot, setEditLot] = React.useState<Lot | null>(null);
  const [viewOpen, setViewOpen] = React.useState(false);
  const [viewLot, setViewLot] = React.useState<Lot | null>(null);

  const cleanupInert = React.useCallback(() => {
    if (typeof document !== 'undefined') {
      document.querySelectorAll('[inert]').forEach((el) => el.removeAttribute('inert'));
      document.body.style.pointerEvents = '';
    }
  }, []);

  const handleAddOpenChange = React.useCallback((o: boolean) => {
    setAddOpen(o);
    if (!o) cleanupInert();
  }, [cleanupInert]);

  const handleEditOpenChange = React.useCallback((o: boolean) => {
    setEditOpen(o);
    if (!o) cleanupInert();
  }, [cleanupInert]);
  const handleViewOpenChange = React.useCallback((o: boolean) => {
    setViewOpen(o);
    if (!o) cleanupInert();
  }, [cleanupInert]);

  const onEdit = React.useCallback((lot: Lot) => {
    setEditLot(lot);
    setEditOpen(true);
  }, []);
  const onView = React.useCallback((lot: Lot) => {
    setViewLot(lot);
    setViewOpen(true);
  }, []);

  const columns = React.useMemo<ColumnDef<Lot>[]>(() => [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          aria-label="Seleziona tutte"
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && 'indeterminate')}
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          aria-label="Seleziona riga"
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(!!v)}
        />
      ),
      enableSorting: false,
      enableHiding: false,
      size: 32,
    },
    {
      accessorKey: 'name',
      header: 'Nome',
      enableSorting: true,
      cell: ({ row }) => (
        <div className="font-medium break-words leading-tight">
          {row.original.name}
        </div>
      ),
    },
    {
      accessorKey: 'location',
      header: 'Locazione',
      enableSorting: true,
      cell: ({ row }) => (
        <span className="truncate">{row.original.location || '—'}</span>
      ),
    },
    {
      accessorKey: 'lot_date',
      header: 'Data raccolta',
      enableSorting: true,
      cell: ({ row }) => (
        <span className="tabular-nums">{formatLotDate(row.original.lot_date)}</span>
      ),
    },
    {
      id: 'description',
      header: 'Descrizione',
      enableSorting: false,
      cell: ({ row }) =>
        row.original.description ? (
          <span className="text-sm text-muted-foreground line-clamp-2 break-words">
            {row.original.description}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: 'items',
      header: 'Prodotti collegati',
      enableSorting: false,
      cell: ({ row }) => (
        <LotItemsCell items={row.original.order_items ?? []} />
      ),
    },
    {
      id: 'actions',
      header: 'Azioni',
      enableSorting: false,
      cell: ({ row }) => (
        <RowActions
          lot={row.original}
          onView={onView}
          onEdit={onEdit}
          onChanged={() => {
            setGlobalError(null);
            refetch();
          }}
          onError={(msg) => setGlobalError(msg)}
        />
      ),
      size: 56,
    },
  ], [onEdit, onView, refetch]);

  const primarySortValue = React.useMemo(() => {
    const first = sorting?.[0];
    if (!first) return 'lot_date-desc';
    const suffix = first.desc ? 'desc' : 'asc';
    switch (first.id) {
      case 'name':
        return `name-${suffix}`;
      case 'location':
        return `location-${suffix}`;
      case 'id':
        return `id-${suffix}`;
      case 'lot_date':
        return `lot_date-${suffix}`;
      default:
        return 'lot_date-desc';
    }
  }, [sorting]);

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

  async function bulkDelete() {
    if (!selectedIds.length) return;
    const errors: string[] = [];
    const results = await Promise.allSettled(
      selectedIds.map((id) => api.delete(`/lots/${id}`))
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
    if (errors.length) setGlobalError(`Alcune eliminazioni sono fallite:\n${errors.join('\n')}`);
    else setGlobalError(null);
    setRowSelection({});
    refetch();
  }

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

  const [confirmBulkOpen, setConfirmBulkOpen] = React.useState(false);
  const handleConfirmBulkOpenChange = React.useCallback((o: boolean) => {
    setConfirmBulkOpen(o);
    if (!o) cleanupInert();
  }, [cleanupInert]);

  const resetFilters = React.useCallback(() => {
    setSearchTerm('');
    setLocationTerm('');
    setDateFrom(undefined);
    setDateTo(undefined);
    setSorting([{ id: 'lot_date', desc: true }]);
    setPage(1);
  }, [setSearchTerm, setLocationTerm, setDateFrom, setDateTo, setSorting, setPage]);

  return (
    <Card className="max-w-full">
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-lg">Lotti</CardTitle>
          {selectedIds.length > 0 ? (
            <Button variant="destructive" onClick={() => handleConfirmBulkOpenChange(true)}>
              Elimina selezionati ({selectedIds.length})
            </Button>
          ) : (
            <Button onClick={() => setAddOpen(true)}>+ Nuovo lotto</Button>
          )}
        </div>

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

        {/* Desktop filters */}
        <div className="hidden md:grid md:grid-cols-6 md:gap-3 min-w-0">
          <div className="col-span-2 grid gap-1 min-w-0">
            <Label>Nome</Label>
            <Input
              placeholder="Cerca per nome…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="min-w-0 w-full max-w-full"
            />
          </div>
          <div className="col-span-2 grid gap-1 min-w-0">
            <Label>Locazione</Label>
            <Input
              placeholder="Cerca per locazione…"
              value={locationTerm}
              onChange={(e) => setLocationTerm(e.target.value)}
              className="min-w-0 w-full max-w-full"
            />
          </div>
          <div className="grid gap-1 min-w-0">
            <Label>Data raccolta da</Label>
            <DatePicker
              value={dateFrom ?? ''}
              onChange={setDateFrom}
              placeholder="Data raccolta da"
              className="min-w-0 w-full max-w-full"
            />
          </div>
          <div className="grid gap-1 min-w-0">
            <Label>Data raccolta a</Label>
            <DatePicker
              value={dateTo ?? ''}
              onChange={setDateTo}
              placeholder="Data raccolta a"
              className="min-w-0 w-full max-w-full"
            />
          </div>
          <div className="col-span-6 flex justify-end items-end min-w-0 pt-1">
            <Button variant="outline" onClick={resetFilters}>
              Reset filtri
            </Button>
          </div>
        </div>

        {/* Mobile filters */}
        <div className="md:hidden space-y-3">
          <div className="grid gap-1 min-w-0">
            <Label>Nome</Label>
            <Input
              placeholder="Cerca per nome…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="min-w-0 w-full max-w-full"
            />
          </div>
          <div className="grid gap-1 min-w-0">
            <Label>Locazione</Label>
            <Input
              placeholder="Cerca per locazione…"
              value={locationTerm}
              onChange={(e) => setLocationTerm(e.target.value)}
              className="min-w-0 w-full max-w-full"
            />
          </div>
          <div className="grid grid-cols-2 gap-3 min-w-0">
            <div className="grid gap-1 min-w-0">
              <Label>Data raccolta da</Label>
              <DatePicker
                value={dateFrom ?? ''}
                onChange={setDateFrom}
                placeholder="Data raccolta da"
              />
            </div>
            <div className="grid gap-1 min-w-0">
              <Label>Data raccolta a</Label>
              <DatePicker
                value={dateTo ?? ''}
                onChange={setDateTo}
                placeholder="Data raccolta a"
              />
            </div>
          </div>
          <div className="grid gap-1 min-w-0">
            <Label className="opacity-0 select-none">Reset</Label>
            <Button variant="outline" onClick={resetFilters} className="w-full">
              Reset filtri
            </Button>
          </div>
          <div className="h-px bg-border" />
          <div className="grid grid-cols-2 gap-3 min-w-0 items-end">
            <label className="inline-flex items-center gap-2 text-sm min-w-0">
              <Checkbox
                checked={rows.length ? (mobileAllSelected || (mobileSomeSelected && 'indeterminate')) : false}
                onCheckedChange={(v) => mobileToggleSelectAll(!!v)}
              />
              <span className="truncate">Seleziona tutti</span>
            </label>
            <div className="grid gap-1 min-w-0">
              <Label>Ordina per</Label>
              <Select
                value={primarySortValue}
                onValueChange={(v) => {
                  if (v === 'name-asc') setSorting([{ id: 'name', desc: false }]);
                  else if (v === 'name-desc') setSorting([{ id: 'name', desc: true }]);
                  else if (v === 'location-asc') setSorting([{ id: 'location', desc: false }]);
                  else if (v === 'location-desc') setSorting([{ id: 'location', desc: true }]);
                  else if (v === 'id-asc') setSorting([{ id: 'id', desc: false }]);
                  else if (v === 'id-desc') setSorting([{ id: 'id', desc: true }]);
                  else if (v === 'lot_date-asc') setSorting([{ id: 'lot_date', desc: false }]);
                  else if (v === 'lot_date-desc') setSorting([{ id: 'lot_date', desc: true }]);
                }}
              >
                <SelectTrigger className="min-w-0 w-full max-w-full">
                  <SelectValue placeholder="Ordina per" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lot_date-desc">Data (più recenti)</SelectItem>
                  <SelectItem value="lot_date-asc">Data (più vecchi)</SelectItem>
                  <SelectItem value="name-asc">Nome (A→Z)</SelectItem>
                  <SelectItem value="name-desc">Nome (Z→A)</SelectItem>
                  <SelectItem value="location-asc">Locazione (A→Z)</SelectItem>
                  <SelectItem value="location-desc">Locazione (Z→A)</SelectItem>
                  <SelectItem value="id-desc">ID (↓)</SelectItem>
                  <SelectItem value="id-asc">ID (↑)</SelectItem>
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
            <div className="hidden md:block w-full overflow-x-auto rounded-md border">
              <div className="md:min-w-[60rem]">
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
                        <TableHead colSpan={columns.length}>Nessun dato</TableHead>
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
                        <TableCell colSpan={columns.length} className="text-center text-sm text-muted-foreground">
                          Nessun lotto trovato.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="md:hidden space-y-2">
              {rows.length ? (
                rows.map((lot) => (
                  <div key={lot.id} className="rounded-md border p-3 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2 min-w-0">
                        <Checkbox
                          checked={!!(rowSelection as any)[String(lot.id)]}
                          onCheckedChange={(v) =>
                            setRowSelection((prev) => ({ ...prev, [String(lot.id)]: !!v }))
                          }
                          aria-label={`Seleziona ${lot.name}`}
                          className="mt-0.5 shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="font-medium break-words leading-tight">{lot.name}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <MapPin className="h-3 w-3" aria-hidden />
                            <span className="truncate">{lot.location || '—'}</span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            Data: {formatLotDate(lot.lot_date)}
                          </div>
                        </div>
                      </div>
                      <RowActions
                        lot={lot}
                        onView={onView}
                        onEdit={onEdit}
                        onChanged={() => {
                          setGlobalError(null);
                          refetch();
                        }}
                        onError={(msg) => setGlobalError(msg)}
                      />
                    </div>

                    {lot.description && (
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">
                        {lot.description}
                      </p>
                    )}

                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-1">
                        prodotti ({lot.order_items?.length ?? 0})
                      </div>
                      <LotItemsCell items={lot.order_items ?? []} />
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-md border p-4 text-center text-sm text-muted-foreground">
                  Nessun lotto trovato.
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

      <AddLotDialog
        open={addOpen}
        onOpenChange={handleAddOpenChange}
        onCreated={() => {
          setGlobalError(null);
          refetch();
        }}
        onError={(msg) => setGlobalError(msg)}
      />

      <EditLotDialog
        open={editOpen}
        onOpenChange={handleEditOpenChange}
        lot={editLot}
        onSaved={() => {
          setGlobalError(null);
          refetch();
        }}
        onDeleted={() => {
          setGlobalError(null);
          refetch();
        }}
        onError={(msg) => setGlobalError(msg)}
      />
      <ViewLotDialog
        open={viewOpen}
        onOpenChange={handleViewOpenChange}
        lot={viewLot}
        onRequestEdit={onEdit}
      />

      <AlertDialog open={confirmBulkOpen} onOpenChange={handleConfirmBulkOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare {selectedIds.length} lotto/i?</AlertDialogTitle>
            <AlertDialogDescription>
              Tutte le associazioni con gli prodotti d&apos;ordine verranno rimosse.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                handleConfirmBulkOpenChange(false);
                await bulkDelete();
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
