'use client';

import * as React from 'react';
import { api } from '@/lib/api-client';
import type { Expense } from '../types/expense';
import { fmtDate } from '../utils/date';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';

/**
 * Edit dialog for expenses
 * - Stable widths; y-scroll only
 * - Mobile footer keeps Delete aligned horizontally with Save/Cancel
 * - Same behavior/validations as before
 */
export function EditExpenseDialog({
  open, onOpenChange, expense, onSaved, onDeleted, onError,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  expense: Expense | null;
  onSaved: () => void;
  onDeleted: () => void;
  onError: (msg: string) => void;
}) {
  const [timestamp, setTimestamp] = React.useState(expense?.timestamp ?? '');
  const [amount, setAmount] = React.useState<number>(expense?.amount ?? 0);
  const [note, setNote] = React.useState<string>(expense?.note ?? '');
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

  React.useEffect(() => {
    if (open && expense) {
      setTimestamp(expense.timestamp ?? '');
      setAmount(expense.amount ?? 0);
      setNote(expense.note ?? '');
      setLocalError(null);
    }
  }, [open, expense]);

  async function save() {
    if (!expense) return;
    if (!timestamp) {
      setLocalError('La data è obbligatoria.');
      return;
    }
    setSaving(true);
    setLocalError(null);
    try {
      await api.patch(`/expenses/${expense.id}`, {
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
    if (!expense) return;
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
            <DialogTitle>Modifica spesa</DialogTitle>
          </DialogHeader>

          {!expense ? (
            <p className="text-sm text-muted-foreground">Nessuna spesa selezionata.</p>
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

              <div className="grid gap-1 min-w-0">
                <Label>Importo</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={String(amount)}
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

          {/* Footer: Delete (left) + Cancel/Save (right); keep in one line on mobile too */}
          <DialogFooter className="mt-2 flex flex-row items-center justify-between gap-2">
            {expense && (
              <Button
                variant="destructive"
                onClick={requestDelete}
              >
                Elimina
              </Button>
            )}
            <div className="flex gap-2">
              <DialogClose asChild>
                <Button variant="outline">Annulla</Button>
              </DialogClose>
              <Button onClick={save} disabled={saving || !expense}>
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
            <AlertDialogTitle>Eliminare la spesa del {fmtDate(expense?.timestamp)}</AlertDialogTitle>
            <AlertDialogDescription>Questa azione non può essere annullata.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!expense) return;
                try {
                  await api.delete(`/expenses/${expense.id}`);
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