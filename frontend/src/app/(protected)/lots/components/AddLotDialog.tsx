'use client';

import * as React from 'react';
import { api } from '@/lib/api-client';
import type { SuccessResponse, Pagination } from '@/types/api';
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
import type { Lot } from '../types/lot';

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
  const [name, setName] = React.useState('');
  const [lotDate, setLotDate] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [selection, setSelection] = React.useState<ItemSelection>({ itemIds: [] });
  const [saving, setSaving] = React.useState(false);
  const [localError, setLocalError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;

    const today = new Date();
    const isoDate = today.toISOString().slice(0, 10);
    const formattedDate = `${today.getFullYear()}_${String(today.getMonth() + 1).padStart(2, '0')}_${String(
      today.getDate()
    ).padStart(2, '0')}`;
    setName(`lotto_n1_${formattedDate}`);
    setLotDate(isoDate);
    setDescription('');
    setSelection({ itemIds: [] });
    setLocalError(null);

    let active = true;
    const fetchMaxLot = async () => {
      try {
        const res = await api.post<SuccessResponse<Pagination<Lot>>>(
          '/lots/list',
          { sort: [{ field: 'id', order: 'desc' }] },
          {
            params: { page: 1, size: 1 },
            headers: { 'Content-Type': 'application/json' },
          }
        );
        const items = res.data.data.items ?? [];
        const maxId = items.length ? Number(items[0].id) : 0;
        if (!active) return;
        const nextId = Number.isFinite(maxId) ? maxId + 1 : 1;
        setName(`lotto_n${nextId}_${formattedDate}`);
      } catch {
        if (!active) return;
        setName(`lotto_n1_${formattedDate}`);
      }
    };

    fetchMaxLot();

    return () => {
      active = false;
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) setLocalError(null);
  }, [open]);

  async function create() {
    if (!name.trim()) {
      setLocalError('Il nome è obbligatorio.');
      return;
    }
    if (!lotDate) {
      setLocalError('La data di raccolta del lotto è obbligatoria.');
      return;
    }

    setSaving(true);
    setLocalError(null);
    try {
      const payload: Record<string, any> = {
        name: name.trim(),
        lot_date: lotDate,
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
            <Label>Numero lotto</Label>
            <Input
              placeholder="Numero lotto"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="min-w-0 w-full max-w-full"
            />
          </div>

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
