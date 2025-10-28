'use client';

import * as React from 'react';
import { api } from '@/lib/api-client';
import { Lot } from '../types/lot';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
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
import { OrderItemsPicker, ItemSelection } from './OrderItemsPicker';
import { composeLotName } from '../utils/name';

/**
 * Edit dialog for an existing lot.
 */
export function EditLotDialog({
  open,
  onOpenChange,
  lot,
  onSaved,
  onDeleted,
  onError,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  lot: Lot | null;
  onSaved: () => void;
  onDeleted: () => void;
  onError: (msg: string) => void;
}) {
  const [lotDate, setLotDate] = React.useState(lot?.lot_date ?? '');
  const [location, setLocation] = React.useState(lot?.location ?? '');
  const [description, setDescription] = React.useState(lot?.description ?? '');
  const [selection, setSelection] = React.useState<ItemSelection>({ itemIds: [] });
  const [saving, setSaving] = React.useState(false);
  const [localError, setLocalError] = React.useState<string | null>(null);

  const initialSelectionRef = React.useRef<ItemSelection>({ itemIds: [] });

  const composedName = React.useMemo(() => {
    const generated = composeLotName(lotDate, location);
    if (generated) return generated;
    return lot?.name ?? '';
  }, [lotDate, location, lot]);

  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);
  const handleConfirmDeleteOpenChange = React.useCallback((o: boolean) => {
    setConfirmDeleteOpen(o);
    if (!o && typeof document !== 'undefined') {
      document.querySelectorAll('[inert]').forEach((el) => el.removeAttribute('inert'));
      (document.body as any).style.pointerEvents = '';
    }
  }, []);

  React.useEffect(() => {
    if (open && lot) {
      setLotDate(lot.lot_date);
      setLocation(lot.location);
      setDescription(lot.description ?? '');
      const itemIds = Array.from(
        new Set((lot.order_items ?? []).map((it) => it.id).filter((id): id is number => typeof id === 'number'))
      );
      setSelection({ itemIds });
      initialSelectionRef.current = { itemIds };
      setLocalError(null);
    }
  }, [open, lot]);

  const normalizeIds = React.useCallback((ids: number[]) => {
    return Array.from(new Set(ids)).sort((a, b) => a - b);
  }, []);

  async function save() {
    if (!lot) return;
    if (!lotDate) {
      setLocalError('La data di raccolta del lotto è obbligatoria.');
      return;
    }
    if (!location.trim()) {
      setLocalError('La locazione è obbligatoria.');
      return;
    }
    if (!composedName) {
      setLocalError('Completa data e locazione per generare il numero lotto.');
      return;
    }

    const payload: Record<string, any> = {
      name: composedName,
      lot_date: lotDate,
      location: location.trim(),
      description: description.trim() ? description.trim() : null,
    };

    const initialIds = normalizeIds(initialSelectionRef.current.itemIds);
    const currentIds = normalizeIds(selection.itemIds);

    const associationsChanged =
      initialIds.length !== currentIds.length ||
      initialIds.some((id, idx) => id !== currentIds[idx]);

    if (associationsChanged) {
      payload.order_item_ids = currentIds;
    }

    setSaving(true);
    setLocalError(null);
    try {
      await api.patch(`/lots/${lot.id}`, payload, {
        headers: { 'Content-Type': 'application/json' },
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
    if (!lot) return;
    setConfirmDeleteOpen(true);
  }

  async function deleteLot() {
    if (!lot) return;
    try {
      await api.delete(`/lots/${lot.id}`);
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
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="
            w-[calc(100vw-2rem)] sm:w-[30rem] md:w-[34rem] lg:w-[38rem]
            max-h-[80dvh] overflow-y-auto overflow-x-hidden
          "
        >
          <DialogHeader>
            <DialogTitle>Modifica lotto</DialogTitle>
          </DialogHeader>

          {!lot ? (
            <p className="text-sm text-muted-foreground">Nessun lotto selezionato.</p>
          ) : (
            <div className="grid gap-3 min-w-0 max-w-full">
              <div className="grid gap-1 min-w-0">
                <Label>Data di raccolta</Label>
                <DatePicker
                  value={lotDate}
                  onChange={setLotDate}
                  placeholder="Seleziona data raccolta"
                  className="min-w-0 w-full max-w-full"
                />
              </div>

              <div className="grid gap-1 min-w-0">
                <Label>Locazione</Label>
                <Input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Inserisci locazione…"
                  className="min-w-0 w-full max-w-full"
                />
              </div>

              <div className="grid gap-1 min-w-0">
                <Label>Numero lotto</Label>
                <Input
                  value={composedName}
                  readOnly
                  placeholder="Generato da data e locazione"
                  className="min-w-0 w-full max-w-full bg-muted/50"
                />
                <p className="text-xs text-muted-foreground">
                  Il numero viene aggiornato automaticamente quando cambi data o locazione.
                </p>
              </div>

              <div className="grid gap-1 min-w-0">
                <Label>Descrizione</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Note aggiuntive"
                  rows={3}
                  className="min-w-0 w-full max-w-full"
                />
              </div>

              <div className="grid gap-2 min-w-0">
                <Label>Associa ordini / prodotti</Label>
                <OrderItemsPicker
                  dialogOpen={open}
                  value={selection}
                  onChange={(next) => {
                    setSelection({ itemIds: Array.from(new Set(next.itemIds)) });
                  }}
                  initialOrderIds={Array.from(
                    new Set(
                      (lot.order_items ?? [])
                        .map((it) => it.order_id)
                        .filter((id): id is number => typeof id === 'number')
                    )
                  )}
                  selectedItemsSnapshot={lot.order_items ?? []}
                />
                <p className="text-xs text-muted-foreground">
                  Aggiorna l&apos;associazione selezionando ordini completi oppure singoli prodotti. Per rimuovere ogni collegamento, svuota la selezione.
                </p>
              </div>

              {localError && <p className="text-sm text-red-600">{localError}</p>}
            </div>
          )}

          <DialogFooter className="mt-2 flex flex-row items-center justify-between gap-2">
            {lot && (
              <Button variant="destructive" onClick={requestDelete}>
                Elimina
              </Button>
            )}
            <div className="flex gap-2">
              <DialogClose asChild>
                <Button variant="outline">Annulla</Button>
              </DialogClose>
              <Button onClick={save} disabled={saving || !lot}>
                {saving ? 'Salvataggio…' : 'Salva'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDeleteOpen} onOpenChange={handleConfirmDeleteOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare questo lotto?</AlertDialogTitle>
            <AlertDialogDescription>
              Tutte le associazioni con prodotti d&apos;ordine verranno rimosse.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={deleteLot}>
              Conferma
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
