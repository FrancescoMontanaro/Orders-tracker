'use client';

import * as React from 'react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { OrderItemsPicker, ItemSelection } from './OrderItemsPicker';
import { composeLotName } from '../utils/name';

/**
 * Creation dialog for new lots.
 * Mirrors UX of existing entity dialogs: fixed width, only vertical scroll.
 */
export function AddLotDialog({
  open,
  onOpenChange,
  onCreated,
  onError,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: () => void;
  onError: (msg: string) => void;
}) {
  const [lotDate, setLotDate] = React.useState('');
  const [location, setLocation] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [selection, setSelection] = React.useState<ItemSelection>({ itemIds: [] });
  const [saving, setSaving] = React.useState(false);
  const [localError, setLocalError] = React.useState<string | null>(null);

  const composedName = React.useMemo(
    () => composeLotName(lotDate, location),
    [lotDate, location]
  );

  React.useEffect(() => {
    if (!open) return;

    const today = new Date();
    const isoDate = today.toISOString().slice(0, 10);
    setLotDate(isoDate);
    setLocation('');
    setDescription('');
    setSelection({ itemIds: [] });
    setLocalError(null);
  }, [open]);

  React.useEffect(() => {
    if (!open) setLocalError(null);
  }, [open]);

  async function create() {
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

    setSaving(true);
    setLocalError(null);
    try {
      const trimmedLocation = location.trim();
      const payload: Record<string, any> = {
        name: composedName,
        lot_date: lotDate,
        location: trimmedLocation,
        description: description.trim() ? description.trim() : null,
      };
      if (selection.itemIds.length) {
        payload.order_item_ids = selection.itemIds;
      }

      await api.post('/lots/', payload, {
        headers: { 'Content-Type': 'application/json' },
      });

      onOpenChange(false);
      onCreated();
    } catch (e: any) {
      const detail =
        e?.response?.data?.detail ??
        e?.response?.data?.message ??
        e?.message ??
        'Errore sconosciuto';
      const msg = `Creazione non riuscita: ${String(detail)}`;
      setLocalError(msg);
      onError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="
          w-[calc(100vw-2rem)] sm:w-[30rem] md:w-[34rem] lg:w-[38rem]
          max-h-[80dvh] overflow-y-auto overflow-x-hidden
        "
      >
        <DialogHeader>
          <DialogTitle>Nuovo lotto</DialogTitle>
        </DialogHeader>

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
              placeholder="Inserisci locazione"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
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
              Il numero viene generato automaticamente (yyyymmdd + locazione).
            </p>
          </div>

          <div className="grid gap-1 min-w-0">
            <Label>Descrizione (facoltativa)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Note aggiuntive visibili solo internamente"
              className="min-w-0 w-full max-w-full"
              rows={3}
            />
          </div>

          <div className="grid gap-2 min-w-0">
            <Label>Associa ordini / prodotti (facoltativo)</Label>
            <OrderItemsPicker
              dialogOpen={open}
              value={selection}
              onChange={(next) => {
                setSelection({ itemIds: Array.from(new Set(next.itemIds)) });
              }}
            />
            <p className="text-xs text-muted-foreground">
              Puoi selezionare uno o più ordini e relativi prodotti. Se scegli un ordine completo, verranno collegati tutti gli prodotti inclusi.
            </p>
          </div>

          {localError && <p className="text-sm text-red-600">{localError}</p>}
        </div>

        <DialogFooter className="mt-2 flex flex-row items-center justify-end gap-2">
          <DialogClose asChild>
            <Button variant="outline">Annulla</Button>
          </DialogClose>
          <Button onClick={create} disabled={saving}>
            {saving ? 'Creazione…' : 'Crea'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
