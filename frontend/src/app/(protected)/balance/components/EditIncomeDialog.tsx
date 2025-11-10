'use client';

import * as React from 'react';
import { api } from '@/lib/api-client';
import type { Income } from '../types/income';
import { fmtDate } from '../utils/date';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';

type IncomeCategory = { id: number; descr: string };

/**
 * Edit dialog for incomes
 * - Adds category select (category_id)
 * - Stable widths; y-scroll only
 * - Mobile footer keeps Delete aligned horizontally with Save/Cancel
 */
export function EditIncomeDialog({
  open, onOpenChange, income, onSaved, onDeleted, onError,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  income: Income | null;
  onSaved: () => void;
  onDeleted: () => void;
  onError: (msg: string) => void;
}) {
  const [timestamp, setTimestamp] = React.useState(income?.timestamp ?? '');
  const [amount, setAmount] = React.useState<number>(income?.amount ?? 0);
  const [note, setNote] = React.useState<string>(income?.note ?? '');
  const [categoryId, setCategoryId] = React.useState<number | undefined>(income?.category_id);

  const [saving, setSaving] = React.useState(false);
  const [localError, setLocalError] = React.useState<string | null>(null);

  // Confirm-delete state + inert cleanup
  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);
  const handleConfirmDeleteOpenChange = React.useCallback((o: boolean) => {
    setConfirmDeleteOpen(o);
    if (!o && typeof document !== 'undefined') {
      document.querySelectorAll('[inert]').forEach((el) => el.removeAttribute('inert'));
      (document.body as any).style.pointerEvents = '';
    }
  }, []);

  // Categories state
  const [categories, setCategories] = React.useState<IncomeCategory[]>([]);
  const [catLoading, setCatLoading] = React.useState(false);
  const [catError, setCatError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open && income) {
      setTimestamp(income.timestamp ?? '');
      setAmount(income.amount ?? 0);
      setNote(income.note ?? '');
      setCategoryId(income.category_id);
      setLocalError(null);
      setCatError(null);
    }
  }, [open, income]);

  // Fetch categories when dialog opens
  React.useEffect(() => {
    if (!open) return;
    let active = true;
    (async () => {
      setCatLoading(true);
      setCatError(null);
      try {
        const res = await api.post(
          '/incomes/categories/list',
          { filters: {}, sort: [{ field: 'id', order: 'asc' as const }] },
          { params: { page: 1, size: -1 } }
        );
        const items: IncomeCategory[] = res?.data?.data?.items ?? [];
        if (active) setCategories(items);
      } catch (e: any) {
        if (active) {
          setCatError(
            e?.response?.data?.detail ??
            e?.response?.data?.message ??
            e?.message ??
            'Errore categorie'
          );
        }
      } finally {
        if (active) setCatLoading(false);
      }
    })();
    return () => { active = false; };
  }, [open]);

  async function save() {
    if (!income) return;
    if (!timestamp) {
      setLocalError('La data è obbligatoria.');
      return;
    }
    if (categoryId === undefined) {
      setLocalError('La categoria è obbligatoria.');
      return;
    }
    setSaving(true);
    setLocalError(null);
    try {
      await api.patch(`/incomes/${income.id}`, {
        category_id: categoryId,
        timestamp,
        amount: Number(amount),
        note: note || null,
      });
      onOpenChange(false);
      onSaved();
    } catch (e: any) {
      const detail = e?.response?.data?.detail ?? e?.response?.data?.message ?? e?.message ?? 'Errore sconosciuto';
      const msg = `Salvataggio non riuscito: ${String(detail)}`;
      setLocalError(msg);
      onError(msg);
    } finally {
      setSaving(false);
    }
  }

  function requestDelete() {
    if (!income) return;
    setConfirmDeleteOpen(true);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="
            w-[calc(100vw-2rem)] sm:w-[28rem] md:w-[32rem] lg:w-[36rem]
            max-h-[80dvh] overflow-y-auto overflow-x-hidden
          "
        >
          <DialogHeader>
            <DialogTitle>Modifica entrata</DialogTitle>
          </DialogHeader>

          {!income ? (
            <p className="text-sm text-muted-foreground">Nessuna entrata selezionata.</p>
          ) : (
            <div className="grid gap-3 min-w-0 max-w-full">
              <div className="grid gap-1 min-w-0">
                <Label>Data</Label>
                <DatePicker
                  value={timestamp}
                  onChange={setTimestamp}
                  placeholder="Seleziona data"
                  className="min-w-0 w-full max-w-full"
                />
              </div>

              {/* Category (required) */}
              <div className="grid gap-1 min-w-0">
                <Label>Categoria</Label>
                <Select
                  disabled={catLoading}
                  value={categoryId === undefined ? undefined : String(categoryId)}
                  onValueChange={(v) => setCategoryId(Number(v))}
                >
                  <SelectTrigger className="min-w-0 w-full max-w-full">
                    <SelectValue placeholder={catLoading ? 'Caricamento…' : 'Seleziona categoria'} />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.descr}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {catError && <p className="text-xs text-red-600 mt-1">{catError}</p>}
              </div>

              <div className="grid gap-1 min-w-0">
                <Label>Importo</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={Number.isFinite(amount) ? String(amount) : ''}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="min-w-0 w-full max-w-full"
                />
              </div>

              <div className="grid gap-1 min-w-0">
                <Label>Nota</Label>
                <Input
                  placeholder="Descrizione (opzionale)"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="min-w-0 w-full max-w-full"
                />
              </div>

              {localError && <p className="text-sm text-red-600">{localError}</p>}
            </div>
          )}

          {/* Footer: Delete (left) + Cancel/Save (right) */}
          <DialogFooter className="mt-2 flex flex-row items-center justify-between gap-2">
            {income && (
              <Button variant="destructive" onClick={requestDelete}>
                Elimina
              </Button>
            )}
            <div className="flex gap-2">
              <DialogClose asChild>
                <Button variant="outline">Annulla</Button>
              </DialogClose>
              <Button onClick={save} disabled={saving || !income}>
                {saving ? 'Salvataggio…' : 'Salva'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm delete (AlertDialog) */}
      <AlertDialog open={confirmDeleteOpen} onOpenChange={handleConfirmDeleteOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Eliminare l&apos;entrata del {fmtDate(income?.timestamp)}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Questa azione non può essere annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!income) return;
                try {
                  await api.delete(`/incomes/${income.id}`);
                  handleConfirmDeleteOpenChange(false);
                  onOpenChange(false);
                  onDeleted();
                } catch (e: any) {
                  const detail = e?.response?.data?.detail ?? e?.response?.data?.message ?? e?.message ?? 'Errore sconosciuto';
                  const msg = `Eliminazione non riuscita: ${String(detail)}`;
                  setLocalError(msg);
                  onError(msg);
                }
              }}
            >
              Conferma
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
