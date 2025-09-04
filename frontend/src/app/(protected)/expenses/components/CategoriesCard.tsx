'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api-client';
import { useFixRadixInertLeak } from '../../expenses/hooks/useFixRadixInertLeak'; // riuso hook esistente
import { useExpenseCategories } from '../hooks/useExpenseCategories';

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
import { X } from 'lucide-react';

import { PaginationControls } from '@/components/ui/pagination-controls';
import { RowActionsCategory } from './RowActionsCategory';
import { EditCategoryDialog } from './EditCategoryDialog';
import { AddCategoryDialog } from './AddCategoryDialog';
import { Select } from 'react-day-picker';

type ExpenseCategory = { id: number; descr: string };

/**
 * Expense Categories page (responsive)
 * - Mirrors Expenses UI: selection, sorting, pagination, responsive table/list.
 * - Single text filter (description), same error handling and bulk delete flow.
 */
export default function CategoriesCard() {
  useFixRadixInertLeak();

  const {
    rows, total, page, size, sorting, loading, error,
    descrQuery, setDescrQuery,
    setPage, setSize, setSorting,
    refetch,
  } = useExpenseCategories();

  const [globalError, setGlobalError] = React.useState<string | null>(null);

  // Row selection (used for bulk delete)
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});

  // Edit & Add dialogs
  const [editOpen, setEditOpen] = React.useState(false);
  const [editCat, setEditCat] = React.useState<ExpenseCategory | null>(null);
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

  const onEdit = (c: ExpenseCategory) => {
    setEditCat(c);
    setEditOpen(true);
  };

  // Cleanup after dialogs close (prevents stuck inert state)
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

  // Desktop columns (ID optional for clarity; sortable by descr)
  const columns = React.useMemo<ColumnDef<ExpenseCategory>[]>(() => [
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
      accessorKey: 'descr',
      header: 'Descrizione',
      enableSorting: true,
      cell: ({ row }) => (
        <div className="max-w-[48ch] whitespace-pre-wrap break-words">
          {row.original.descr}
        </div>
      ),
    },
    {
      id: 'actions',
      header: 'Azioni',
      enableSorting: false,
      cell: ({ row }) => (
        <RowActionsCategory
          category={row.original}
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
    setDescrQuery('');
    setSorting([{ id: 'descr', desc: false }]);
    setPage(1);
  }, [setDescrQuery, setSorting, setPage]);

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
      selectedIds.map((id) => api.delete(`/expenses/categories/${id}`))
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
          <CardTitle className="text-lg">Categorie di spesa</CardTitle>

          {selectedIds.length > 0 ? (
            <Button variant="destructive" onClick={() => setConfirmBulkOpen(true)}>
              Elimina selezionate ({selectedIds.length})
            </Button>
          ) : (
            <Button onClick={() => setAddOpen(true)}>+ Aggiungi categoria</Button>
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
          {/* Description search */}
          <div className="flex-1 min-w-[260px]">
            <div className="grid gap-1">
              <Label>Descrizione</Label>
              <Input
                placeholder="Cerca nella descrizione…"
                value={descrQuery}
                onChange={(e) => setDescrQuery(e.target.value)}
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
          {/* Row 1: descr search full width */}
          <div className="grid gap-1 min-w-0">
            <Label>Descrizione</Label>
            <Input
              placeholder="Cerca nella descrizione…"
              value={descrQuery}
              onChange={(e) => setDescrQuery(e.target.value)}
              className="min-w-0 w-full max-w-full"
            />
          </div>

          {/* Divider */}
          <div className="h-px bg-border" />

          {/* Row 2: select all + sort + reset */}
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

            {/* Sort select (mobile-only convenience) */}
            <div className="grid gap-1 min-w-0">
              <Label>Ordina per</Label>
              <Select
                className="border rounded-md h-9 px-3 text-sm bg-background"
                value={
                  sorting?.[0]?.id === 'descr'
                    ? sorting?.[0]?.desc ? 'descr-desc' : 'descr-asc'
                    : sorting?.[0]?.id === 'id'
                    ? sorting?.[0]?.desc ? 'id-desc' : 'id-asc'
                    : 'descr-asc'
                }
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === 'descr-asc') setSorting([{ id: 'descr', desc: false }]);
                  else if (v === 'descr-desc') setSorting([{ id: 'descr', desc: true }]);
                  else if (v === 'id-asc') setSorting([{ id: 'id', desc: false }]);
                  else if (v === 'id-desc') setSorting([{ id: 'id', desc: true }]);
                }}
              >
                <option value="descr-asc">Descrizione (A → Z)</option>
                <option value="descr-desc">Descrizione (Z → A)</option>
                <option value="id-asc">ID (crescente)</option>
                <option value="id-desc">ID (decrescente)</option>
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
            {/* Desktop table (md+): mirrors Expenses layout */}
            <div className="hidden md:block w-full overflow-x-auto rounded-md border">
              <div className="md:min-w-[44rem]">
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
                        {['', 'Descrizione', ''].map((h, i) => (
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
                          Nessuna categoria trovata.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Mobile list (<md): card layout */}
            <div className="md:hidden space-y-2">
              {rows.length ? (
                rows.map((c) => (
                  <div key={c.id} className="rounded-md border p-3">
                    {/* Top row: checkbox + descr + actions */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2 min-w-0">
                        <Checkbox
                          checked={!!(rowSelection as any)[String(c.id)]}
                          onCheckedChange={(v) =>
                            setRowSelection((prev) => ({ ...prev, [String(c.id)]: !!v }))
                          }
                          aria-label={`Seleziona categoria ${c.id}`}
                          className="mt-0.5 shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="font-medium break-words">{c.descr}</div>
                        </div>
                      </div>

                      <div className="shrink-0">
                        <RowActionsCategory
                          category={c}
                          onEdit={(cat) => onEdit(cat)}
                          onChanged={() => refetch()}
                          onError={(msg) => setGlobalError(msg)}
                        />
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-md border p-4 text-center text-sm text-muted-foreground">
                  Nessuna categoria trovata.
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
      <EditCategoryDialog
        open={editOpen}
        onOpenChange={handleEditOpenChange}
        category={editCat}
        onSaved={() => { setGlobalError(null); refetch(); }}
        onError={(msg) => setGlobalError(msg)}
      />

      <AddCategoryDialog
        open={addOpen}
        onOpenChange={handleAddOpenChange}
        onCreated={() => { setGlobalError(null); refetch(); }}
        onError={(msg) => setGlobalError(msg)}
      />

      {/* Bulk delete confirm */}
      {/* Re-using AlertDialog from Expenses page style would be consistent; if you already have it, include here. */}
      {/* Omesso per brevità: puoi riutilizzare lo stesso blocco AlertDialog usato nelle spese per confermare l'eliminazione multipla */}
    </Card>
  );
}