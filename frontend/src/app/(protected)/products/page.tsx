'use client';

import Link from 'next/link';
import * as React from 'react';
import { cn } from '@/lib/utils';
import { useFixRadixInertLeak } from './hooks/useFixRadixInertLeak';
import { useProducts } from './hooks/useProducts';
import { euro } from './utils/currency';
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
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { X } from 'lucide-react';

import { PaginationControls } from '@/components/ui/pagination-controls';
import { RowActions } from './components/RowActions';
import { EditProductDialog } from './components/EditProductDialog';
import { ViewProductDialog } from './components/ViewProductDialog';
import { AddProductDialog } from './components/AddProductDialog';

import type { Product } from './types/product';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';

/**
 * Products page
 * - Desktop: classic table (md+)
 * - Mobile: card list + toolbar (select all + sort)
 * - No horizontal overflow (min-w-0 everywhere + mobile-safe link)
 */
export default function ProductsPage() {
  useFixRadixInertLeak();

  const {
    rows, total, page, size, sorting, loading, error,
    searchName, unitFilter, statusFilter,
    setPage, setSize, setSorting, setSearchName, setUnitFilter, setStatusFilter,
    refetch,
  } = useProducts();

  const [globalError, setGlobalError] = React.useState<string | null>(null);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});

  const [editOpen, setEditOpen] = React.useState(false);
  const [editProduct, setEditProduct] = React.useState<Product | null>(null);
  const [viewOpen, setViewOpen] = React.useState(false);
  const [viewProduct, setViewProduct] = React.useState<Product | null>(null);
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

  const onEdit = React.useCallback((p: Product) => {
    setEditProduct(p);
    setEditOpen(true);
  }, []);
  const onView = React.useCallback((p: Product) => {
    setViewProduct(p);
    setViewOpen(true);
  }, []);

  // Cleanup helper after dialogs close
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
  const handleViewOpenChange = React.useCallback((o: boolean) => {
    setViewOpen(o);
    if (!o) cleanupInert();
  }, [cleanupInert]);
  const handleAddOpenChange = React.useCallback((o: boolean) => {
    setAddOpen(o);
    if (!o) cleanupInert();
  }, [cleanupInert]);

  // Columns (desktop)
  const columns = React.useMemo<ColumnDef<Product>[]>(() => [
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
      accessorKey: 'name',
      header: 'Nome',
      enableSorting: true,
      cell: ({ row }) => (
        <Link
          href={{ pathname: '/reports', query: { product_id: row.original.id } }}
          className="font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm whitespace-pre-wrap break-words"
          title="Vai al report del prodotto"
        >
          {row.original.name}
        </Link>
      ),
    },
    {
      accessorKey: 'unit_price',
      header: 'Prezzo',
      enableSorting: true,
      cell: ({ row }) => <span className="tabular-nums">{euro(row.original.unit_price)}</span>,
    },
    {
      accessorKey: 'unit',
      header: 'Unità',
      enableSorting: true,
    },
    {
      accessorKey: 'is_active',
      header: 'Attivo',
      enableSorting: true,
      cell: ({ row }) => (
        <span
          className={cn(
            'text-xs rounded px-2 py-0.5 border',
            row.original.is_active
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
              : 'bg-muted text-muted-foreground'
          )}
        >
          {row.original.is_active ? 'Sì' : 'No'}
        </span>
      ),
    },
    {
      id: 'actions',
      header: 'Azioni',
      enableSorting: false,
      cell: ({ row }) => (
        <RowActions
          product={row.original}
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
    setUnitFilter(undefined);
    setStatusFilter('active');
    setSorting([{ id: 'name', desc: false }]);
    setPage(1);
  }, [setSearchName, setUnitFilter, setStatusFilter, setSorting, setPage]);

  const [errorVisible, setErrorVisible] = React.useState(false);
  React.useEffect(() => {
    if (globalError || error) setErrorVisible(true);
  }, [globalError, error]);

  // Bulk delete
  async function bulkDelete() {
    setGlobalError(null);
    if (!selectedIds.length) return;

    const errors: string[] = [];
    const results = await Promise.allSettled(
      selectedIds.map((id) => api.delete(`/products/${id}`))
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

  // Mobile helpers: select all current page
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
        {/* Title + primary actions */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-lg">Prodotti</CardTitle>

          {selectedIds.length > 0 ? (
            <Button variant="destructive" onClick={() => handleConfirmBulkOpenChange(true)}>
              Elimina selezionati ({selectedIds.length})
            </Button>
          ) : (
            <Button onClick={() => setAddOpen(true)}>+ Aggiungi prodotto</Button>
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
          {/* Name */}
          <div className="flex-1 min-w-[220px]">
            <div className="grid gap-1">
              <Label>Nome</Label>
              <Input
                placeholder="Cerca per nome…"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                className="min-w-0 w-full max-w-full"
              />
            </div>
          </div>

          {/* Unit */}
          <div className="flex-1 min-w-[220px]">
            <div className="grid gap-1">
              <Label>Unità</Label>
              <Select
                value={unitFilter ?? 'all'}
                onValueChange={(v: 'Kg' | 'Px' | 'all') =>
                  setUnitFilter(v === 'all' ? undefined : (v as 'Kg' | 'Px'))
                }
              >
                <SelectTrigger className="min-w-0 w-full max-w-full">
                  <SelectValue placeholder="Tutte" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutte</SelectItem>
                  <SelectItem value="Kg">Kg</SelectItem>
                  <SelectItem value="Px">Px</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Status */}
          <div className="flex-1 min-w-[220px]">
            <div className="grid gap-1">
              <Label>Stato</Label>
              <Select
                value={statusFilter}
                onValueChange={(v: 'all' | 'active' | 'inactive') => setStatusFilter(v)}
              >
                <SelectTrigger className="min-w-0 w-full max-w-full">
                  <SelectValue placeholder="Tutti" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti</SelectItem>
                  <SelectItem value="active">Attivi</SelectItem>
                  <SelectItem value="inactive">Non attivi</SelectItem>
                </SelectContent>
              </Select>
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

        {/* ===== Mobile filters (<md) + toolbar ===== */}
        <div className="md:hidden space-y-3">
          {/* Row 1: search */}
          <div className="grid gap-1 min-w-0">
            <Label>Nome</Label>
            <Input
              placeholder="Cerca per nome…"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              className="min-w-0 w-full max-w-full"
            />
          </div>

          {/* Row 2: unit + status */}
          <div className="grid grid-cols-2 gap-3 min-w-0">
            <div className="grid gap-1 min-w-0">
              <Label>Unità</Label>
              <Select
                value={unitFilter ?? 'all'}
                onValueChange={(v: 'Kg' | 'Px' | 'all') =>
                  setUnitFilter(v === 'all' ? undefined : (v as 'Kg' | 'Px'))
                }
              >
                <SelectTrigger className="min-w-0 w-full max-w-full">
                  <SelectValue placeholder="Tutte" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutte</SelectItem>
                  <SelectItem value="Kg">Kg</SelectItem>
                  <SelectItem value="Px">Px</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1 min-w-0">
              <Label>Stato</Label>
              <Select
                value={statusFilter}
                onValueChange={(v: 'all' | 'active' | 'inactive') => setStatusFilter(v)}
              >
                <SelectTrigger className="min-w-0 w-full max-w-full">
                  <SelectValue placeholder="Tutti" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti</SelectItem>
                  <SelectItem value="active">Attivi</SelectItem>
                  <SelectItem value="inactive">Non attivi</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 3: reset */}
          <div className="grid gap-1 min-w-0">
            <Label className="opacity-0 select-none">Reset</Label>
            <Button variant="outline" onClick={resetFilters} className="w-full">
              Reset filtri
            </Button>
          </div>

          {/* Divider */}
          <div className="h-px bg-border" />

          {/* Row 4: select all + sort */}
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
                  sorting?.[0]?.id === 'name' ? (sorting?.[0]?.desc ? 'name-desc' : 'name-asc')
                  : sorting?.[0]?.id === 'unit_price' ? (sorting?.[0]?.desc ? 'price-desc' : 'price-asc')
                  : sorting?.[0]?.id === 'unit' ? (sorting?.[0]?.desc ? 'unit-desc' : 'unit-asc')
                  : sorting?.[0]?.id === 'is_active' ? (sorting?.[0]?.desc ? 'active-desc' : 'active-asc')
                  : 'name-asc'
                }
                onValueChange={(v) => {
                  if (v === 'name-asc') setSorting([{ id: 'name', desc: false }]);
                  else if (v === 'name-desc') setSorting([{ id: 'name', desc: true }]);
                  else if (v === 'price-asc') setSorting([{ id: 'unit_price', desc: false }]);
                  else if (v === 'price-desc') setSorting([{ id: 'unit_price', desc: true }]);
                  else if (v === 'unit-asc') setSorting([{ id: 'unit', desc: false }]);
                  else if (v === 'unit-desc') setSorting([{ id: 'unit', desc: true }]);
                  else if (v === 'active-asc') setSorting([{ id: 'is_active', desc: false }]);
                  else if (v === 'active-desc') setSorting([{ id: 'is_active', desc: true }]);
                }}
              >
                <SelectTrigger className="min-w-0 w-full max-w-full">
                  <SelectValue placeholder="Ordina per" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name-asc">Nome (A→Z)</SelectItem>
                  <SelectItem value="name-desc">Nome (Z→A)</SelectItem>
                  <SelectItem value="price-asc">Prezzo (↑)</SelectItem>
                  <SelectItem value="price-desc">Prezzo (↓)</SelectItem>
                  <SelectItem value="unit-asc">Unità (A→Z)</SelectItem>
                  <SelectItem value="unit-desc">Unità (Z→A)</SelectItem>
                  <SelectItem value="active-asc">Attivo (No→Sì)</SelectItem>
                  <SelectItem value="active-desc">Attivo (Sì→No)</SelectItem>
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
              <div className="md:min-w-[56rem]">
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
                        {['', 'Nome', 'Prezzo', 'Unità', 'Attivo', ''].map((h, i) => (
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
                          Nessun prodotto trovato.
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
                  <div key={r.id} className="rounded-md border p-3">
                    {/* Top row: checkbox + name + actions */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2 min-w-0">
                        <Checkbox
                          checked={!!(rowSelection as any)[String(r.id)]}
                          onCheckedChange={(v) =>
                            setRowSelection((prev) => ({ ...prev, [String(r.id)]: !!v }))
                          }
                          aria-label={`Seleziona ${r.name}`}
                          className="mt-0.5 shrink-0"
                        />
                        <div className="min-w-0">
                          <Link
                            href={{ pathname: '/reports', query: { product_id: r.id } }}
                            className="font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm whitespace-pre-wrap break-words"
                            title="Vai al report del prodotto"
                          >
                            {r.name}
                          </Link>
                          <div className="mt-1 text-xs text-muted-foreground">
                            Prezzo: <span className="tabular-nums">{euro(r.unit_price)}</span> · Unità: {r.unit}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0">
                        <RowActions
                          product={r}
                          onView={onView}
                          onEdit={(p) => onEdit(p)}
                          onChanged={() => refetch()}
                          onError={(msg) => setGlobalError(msg)}
                        />
                      </div>
                    </div>

                    {/* Bottom row: status pill */}
                    <div className="mt-2 flex items-center justify-between">
                      <span
                        className={cn(
                          'text-xs rounded px-2 py-0.5 border',
                          r.is_active
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                            : 'bg-muted text-muted-foreground'
                        )}
                      >
                        {r.is_active ? 'Attivo' : 'Non attivo'}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-md border p-4 text-center text-sm text-muted-foreground">
                  Nessun prodotto trovato.
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
      <EditProductDialog
        open={editOpen}
        onOpenChange={handleEditOpenChange}
        product={editProduct}
        onSaved={() => { setGlobalError(null); refetch(); }}
        onDeleted={() => { setGlobalError(null); refetch(); }}
        onError={(msg) => setGlobalError(msg)}
      />

      <ViewProductDialog
        open={viewOpen}
        onOpenChange={handleViewOpenChange}
        product={viewProduct}
        onRequestEdit={onEdit}
      />

      <AddProductDialog
        open={addOpen}
        onOpenChange={handleAddOpenChange}
        onCreated={() => { setGlobalError(null); refetch(); }}
        onError={(msg) => setGlobalError(msg)}
      />

      {/* Bulk delete confirm */}
      <AlertDialog open={confirmBulkOpen} onOpenChange={handleConfirmBulkOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare {selectedIds.length} prodotto/i?</AlertDialogTitle>
            <AlertDialogDescription>
              Questa azione non può essere annullata.
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
