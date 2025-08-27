'use client';

import * as React from 'react';
import { api } from '@/lib/api-client';
import type { Customer } from '../types/customer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';

/**
 * Edit dialog for a single customer.
 * Functionality unchanged: same validations, API calls, and cleanup steps.
 */
export function EditCustomerDialog({
  open, onOpenChange, customer, onSaved, onDeleted, onError,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  customer: Customer | null;
  onSaved: () => void;
  onDeleted: () => void;
  onError: (msg: string) => void;
}) {
  const [name, setName] = React.useState(customer?.name ?? '');
  const [isActive, setIsActive] = React.useState<boolean>(customer?.is_active ?? true);
  const [saving, setSaving] = React.useState(false);
  const [localError, setLocalError] = React.useState<string | null>(null);

  // Confirm-delete state + inert cleanup (unchanged behavior).
  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);
  const handleConfirmDeleteOpenChange = React.useCallback((o: boolean) => {
    setConfirmDeleteOpen(o);
    if (!o && typeof document !== 'undefined') {
      document.querySelectorAll('[inert]').forEach((el) => el.removeAttribute('inert'));
      (document.body as any).style.pointerEvents = '';
    }
  }, []);

  React.useEffect(() => {
    if (open && customer) {
      setName(customer.name);
      setIsActive(customer.is_active);
      setLocalError(null);
    }
  }, [open, customer]);

  async function save() {
    if (!customer) return;
    if (!name.trim()) {
      setLocalError('Il nome è obbligatorio.');
      return;
    }
    setSaving(true);
    setLocalError(null);
    try {
      await api.patch(`/customers/${customer.id}`, {
        name: name.trim(),
        is_active: isActive,
      });
      onOpenChange(false);
      onSaved();
    } catch (e: any) {
      const detail =
        e?.response?.data?.detail ??
        e?.response?.data?.message ??
        e?.message ??
        'Errore sconosciuto';
      const msg = `Salvataggio non riuscito: ${String(detail)}`;
      setLocalError(msg);
      onError(msg);
    } finally {
      setSaving(false);
    }
  }

  function requestDelete() {
    if (!customer) return;
    setConfirmDeleteOpen(true);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        {/* Fixed widths per breakpoint; vertical scroll only */}
        <DialogContent className="
          w-[calc(100vw-2rem)] sm:w-[28rem] md:w-[32rem] lg:w-[36rem]
          max-h-[80dvh] overflow-y-auto overflow-x-hidden
        ">
          <DialogHeader>
            <DialogTitle>Modifica cliente</DialogTitle>
          </DialogHeader>

          {!customer ? (
            <p className="text-sm text-muted-foreground">Nessun cliente selezionato.</p>
          ) : (
            <div className="grid gap-3 min-w-0 max-w-full">
              <div className="grid gap-1 min-w-0">
                <Label>Nome</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} className="min-w-0 w-full max-w-full" />
              </div>

              <div className="grid gap-1 min-w-0">
                <Label>Stato</Label>
                <Select
                  value={isActive ? 'active' : 'inactive'}
                  onValueChange={(v: 'active' | 'inactive') => setIsActive(v === 'active')}
                >
                  <SelectTrigger className="min-w-0 w-full max-w-full">
                    <SelectValue placeholder="Stato" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Attivo</SelectItem>
                    <SelectItem value="inactive">Non attivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {localError && <p className="text-sm text-red-600">{localError}</p>}
            </div>
          )}

          {/* Footer: destructive left, actions right; wraps nicely on small screens */}
          <DialogFooter className="mt-2 flex flex-row items-center justify-between gap-2">
            {customer && (
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
              <Button onClick={save} disabled={saving || !customer}>
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
            <AlertDialogTitle>Eliminare questo cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Questa azione non può essere annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!customer) return;
                try {
                  await api.delete(`/customers/${customer.id}`);
                  handleConfirmDeleteOpenChange(false);
                  onOpenChange(false);
                  onDeleted();
                } catch (e: any) {
                  const detail =
                    e?.response?.data?.detail ??
                    e?.response?.data?.message ??
                    e?.message ??
                    'Errore sconosciuto';
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