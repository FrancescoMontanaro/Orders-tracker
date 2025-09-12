'use client';

import * as React from 'react';
import { api } from '@/lib/api-client';
import { useNotes } from './hooks/useNotes';
import type { Note } from './types/note';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import { Skeleton } from '@/components/ui/skeleton';
import { X } from 'lucide-react';

import { AddNoteDialog } from './components/AddNoteDialog';
import { EditNoteDialog } from './components/EditNoteDialog';
import { ViewNoteDialog } from './components/ViewNoteDialog';
import { NoteCard } from './components/NoteCard';
import { groupNotesByPeriod } from './utils/groupNotes';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';

/**
 * Notes main page (kanban-like):
 * - Colonne verticali responsive (1/2/3) con distribuzione round-robin.
 * - Selezione multi-card su intera card (no checkbox).
 * - Nessuna barra azioni: il bottone "+ Aggiungi nota" diventa "Elimina selezionate (N)".
 * - Niente UI di ordinamento (rimane quello di default).
 */
export default function NotesPage() {
  const {
    rows, total, page, size, sorting,
    searchText, setSearchText,
    createdAfter, setCreatedAfter,
    createdBefore, setCreatedBefore,
    setPage, setSize, setSorting,
    loading, error, refetch,
  } = useNotes();

  // Dialogs
  const [addOpen, setAddOpen] = React.useState(false);
  const [viewOpen, setViewOpen] = React.useState(false);
  const [viewNote, setViewNote] = React.useState<Note | null>(null);
  const [editOpen, setEditOpen] = React.useState(false);
  const [editNote, setEditNote] = React.useState<Note | null>(null);

  // Error banner
  const [globalError, setGlobalError] = React.useState<string | null>(null);
  const [errorVisible, setErrorVisible] = React.useState(false);
  React.useEffect(() => {
    if (globalError || error) setErrorVisible(true);
  }, [globalError, error]);

  // Formatter date
  const fmtDate = React.useCallback((s: string) => {
    try { return new Date(s).toLocaleString(); } catch { return s; }
  }, []);

  // Grouping
  const groups = React.useMemo(() => groupNotesByPeriod(rows), [rows]);

  // Filters reset
  function resetFilters() {
    setSearchText('');
    setCreatedAfter(null);
    setCreatedBefore(null);
    setSorting?.([{ id: 'updated_at', desc: true }]);
    setPage(1);
  }

  // Openers
  function openView(n: Note) { setViewNote(n); setViewOpen(true); }
  function openEdit(n: Note) { setEditNote(n); setEditOpen(true); }

  // ===== Selezione multipla =====
  const [selectMode, setSelectMode] = React.useState(false);
  const [selectedIds, setSelectedIds] = React.useState<Set<number>>(new Set());
  const [confirmBatchOpen, setConfirmBatchOpen] = React.useState(false);

  function toggleSelect(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function clearSelection() { setSelectedIds(new Set()); }

  async function deleteSelected() {
    if (selectedIds.size === 0) return;
    try {
      await Promise.allSettled(Array.from(selectedIds).map(id => api.delete(`/notes/${id}`)));
      clearSelection();
      setSelectMode(false);
      setGlobalError(null);
      await refetch();
    } catch (e: any) {
      const detail = e?.response?.data?.detail ?? e?.response?.data?.message ?? e?.message ?? 'Errore sconosciuto';
      setGlobalError(`Eliminazione batch non riuscita: ${String(detail)}`);
    }
  }

  // ===== Layout colonne responsivo (kanban-like) =====
  const colCount = useResponsiveColumns(); // 1/2/3
  const groupsWithColumns = React.useMemo(() => ({
    last30d: splitIntoColumns(groups.last30d, colCount),
    monthsThisYear: groups.monthsThisYear.map(g => ({ ...g, cols: splitIntoColumns(g.items, colCount) })),
    years: groups.years.map(g => ({ ...g, cols: splitIntoColumns(g.items, colCount) })),
  }), [groups, colCount]);

  return (
    <Card className="max-w-full">
      <CardHeader className="space-y-4">
        {/* Header row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <CardTitle className="text-lg">Note</CardTitle>

          <div className="flex items-center gap-2">
            {!selectMode ? (
              <>
                <Button onClick={() => setAddOpen(true)}>+ Aggiungi nota</Button>
                <Button variant="outline" onClick={() => setSelectMode(true)}>Seleziona</Button>
              </>
            ) : (
              <>
                <Button
                  variant="destructive"
                  className="whitespace-nowrap"
                  onClick={() => setConfirmBatchOpen(true)}
                  disabled={selectedIds.size === 0}
                >
                  Elimina selezionate ({selectedIds.size})
                </Button>
                <Button
                  variant="outline"
                  onClick={() => { setSelectMode(false); clearSelection(); }}
                >
                  Annulla
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Errori globali */}
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

        {/* Filtri (senza ordinamento) */}
        <div className="grid gap-3 md:grid-cols-3">
          <div className="grid gap-1 min-w-0">
            <Label>Ricerca</Label>
            <Input
              placeholder="Cerca nel testo…"
              value={searchText}
              onChange={(e) => { setSearchText(e.target.value); setPage(1); }}
              className="min-w-0 w-full max-w-full"
            />
          </div>
          <div className="grid gap-1 min-w-0">
            <Label>Creato dopo</Label>
            <DatePicker value={createdAfter ?? ''} onChange={setCreatedAfter} placeholder="Creata da" />
          </div>
          <div className="grid gap-1 min-w-0">
            <Label>Creato prima</Label>
            <DatePicker value={createdBefore ?? ''} onChange={setCreatedBefore} placeholder="Creata fino a" />
          </div>
        </div>

        {/* Reset */}
        <div className="flex justify-end">
          <Button variant="outline" onClick={resetFilters} className="w-full sm:w-auto">Reset filtri</Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 overflow-x-hidden">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-5/6" />
            <Skeleton className="h-24 w-2/3" />
          </div>
        ) : (
          <>
            <SectionCols
              title="Ultimi 30 giorni"
              cols={groupsWithColumns.last30d}
              fmtDate={fmtDate}
              onView={openView}
              selectMode={selectMode}
              selectedIds={selectedIds}
              onToggleSelect={(id) => toggleSelect(id)}
            />
            {groupsWithColumns.monthsThisYear.map(({ key, label, cols }) => (
              <SectionCols
                key={key}
                title={label.charAt(0).toUpperCase() + label.slice(1)}
                cols={cols}
                fmtDate={fmtDate}
                onView={openView}
                selectMode={selectMode}
                selectedIds={selectedIds}
                onToggleSelect={(id) => toggleSelect(id)}
              />
            ))}
            {groupsWithColumns.years.map(({ key, label, cols }) => (
              <SectionCols
                key={key}
                title={label}
                cols={cols}
                fmtDate={fmtDate}
                onView={openView}
                selectMode={selectMode}
                selectedIds={selectedIds}
                onToggleSelect={(id) => toggleSelect(id)}
              />
            ))}
          </>
        )}
      </CardContent>

      {/* Dialogs */}
      <AddNoteDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={() => { setGlobalError(null); refetch(); }}
        onError={(msg) => setGlobalError(msg)}
      />
      <ViewNoteDialog
        open={viewOpen}
        onOpenChange={setViewOpen}
        note={viewNote}
        fmtDate={fmtDate}
        onRequestEdit={(n) => openEdit(n)}
      />
      <EditNoteDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        note={editNote}
        onSaved={() => { setGlobalError(null); refetch(); }}
        onDeleted={() => { setGlobalError(null); refetch(); }}
        onError={(msg) => setGlobalError(msg)}
      />

      {/* Conferma eliminazione batch */}
      <AlertDialog open={confirmBatchOpen} onOpenChange={setConfirmBatchOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Eliminare {selectedIds.size} not{selectedIds.size !== 1 ? 'e' : 'a'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Questa azione non può essere annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setConfirmBatchOpen(false);
                await deleteSelected();
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

/** Hook per contare le colonne come i breakpoint Tailwind (sm=640, lg=1024). */
function useResponsiveColumns() {
  const [cols, setCols] = React.useState(1);
  React.useEffect(() => {
    const mqSm = window.matchMedia('(min-width: 640px)');
    const mqLg = window.matchMedia('(min-width: 1024px)');
    const calc = () => setCols(mqLg.matches ? 3 : mqSm.matches ? 2 : 1);
    calc();
    mqSm.addEventListener('change', calc);
    mqLg.addEventListener('change', calc);
    return () => {
      mqSm.removeEventListener('change', calc);
      mqLg.removeEventListener('change', calc);
    };
  }, []);
  return cols;
}

/** Divide un array di note in N colonne (round-robin), stile kanban. */
function splitIntoColumns(notes: Note[], nCols: number): Note[][] {
  const cols: Note[][] = Array.from({ length: Math.max(1, nCols) }, () => []);
  notes.forEach((n, i) => cols[i % cols.length].push(n));
  return cols;
}

/** Sezione con colonne già splittate e cards cliccabili/selezionabili. */
function SectionCols({
  title, cols, onView, fmtDate, selectMode, selectedIds, onToggleSelect,
}: {
  title: string;
  cols: Note[][];
  onView: (n: Note) => void;
  fmtDate: (s: string) => string;
  selectMode: boolean;
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;
}) {
  const totalItems = cols.reduce((a, c) => a + c.length, 0);
  if (totalItems === 0) return null;

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold tracking-wide text-muted-foreground">{title}</h3>

      {/* Colonne verticali (kanban-like) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pb-1">
        {cols.map((col, ci) => (
          <div key={ci} className="flex flex-col gap-3">
            {col.map((n) => (
              <NoteCard
                key={n.id}
                note={n}
                fmtDate={fmtDate}
                onOpenView={onView}
                selectMode={selectMode}
                selected={selectedIds.has(n.id)}
                onToggleSelect={onToggleSelect}
              />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}