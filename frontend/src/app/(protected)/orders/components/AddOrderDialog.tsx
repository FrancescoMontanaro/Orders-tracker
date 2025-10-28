'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { api } from '@/lib/api-client';

import { SearchCombobox } from './SearchCombobox';
import { ItemsEditor } from './ItemsEditor';
import { usePreviewTotals } from '../hooks/usePreviewTotals';
import { euro } from '../utils/currency';
import { Option } from '../types/option';
import { OrderItem } from '../types/order';
import { LotSelect } from '@/components/lot-select';
import type { LotOption } from '@/types/lot';
import { formatLotOptionDate } from '@/types/lot';

/**
 * AddOrderDialog (responsive)
 * - Fixed width per breakpoint to avoid layout shifts.
 * - Vertical scroll only; horizontal overflow is hidden.
 * - Inputs/selects use min-w-0 to prevent accidental horizontal overflow.
 * - Footer actions stay horizontal and wrap gracefully on small screens.
 */
export function AddOrderDialog({
  open, onOpenChange, onCreated, onError,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: () => void;
  onError: (msg: string) => void;
}) {
  const [deliveryDate, setDeliveryDate] = React.useState<string>('');
  const [customer, setCustomer] = React.useState<Option | null>(null);
  const [appliedDiscount, setAppliedDiscount] = React.useState<number | ''>('');
  const [status, setStatus] = React.useState<'created' | 'delivered'>('created');
  const [items, setItems] = React.useState<OrderItem[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [localError, setLocalError] = React.useState<string | null>(null);
  const [orderLot, setOrderLot] = React.useState<LotOption | null>(null);

  // Reset form state when the dialog opens
  React.useEffect(() => {
    if (open) {
      setDeliveryDate('');
      setCustomer(null);
      setAppliedDiscount('');
      setStatus('created');
      setItems([]);
      setLocalError(null);
      setOrderLot(null);
    }
  }, [open]);

  // Totals preview (computed client-side, independent from the payload)
  const totals = usePreviewTotals(items, appliedDiscount);

  React.useEffect(() => {
    if (!orderLot) return;
    setItems((prev) =>
      prev.map((item) =>
        item.lot_id ? item : {
          ...item,
          lot_id: orderLot.id,
          lot_name: orderLot.name,
          lot_date: orderLot.lot_date ?? null,
        }
      )
    );
  }, [orderLot]);

  const applyLotToAll = React.useCallback((lot: LotOption | null) => {
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        lot_id: lot ? lot.id : null,
        lot_name: lot ? lot.name : null,
        lot_date: lot ? lot.lot_date ?? null : null,
      }))
    );
  }, []);

  const clearAllLots = React.useCallback(() => {
    applyLotToAll(null);
    setOrderLot(null);
  }, [applyLotToAll]);

  // Create order and send to API
  async function create() {
    // Client-side validations for fast feedback
    if (!deliveryDate) return setLocalError('La data di consegna è obbligatoria.');
    if (!customer?.id) return setLocalError('Il cliente è obbligatorio.');
    if (!items.length) return setLocalError('Aggiungi almeno un prodotto.');

    // Build items payload, including unit_price only when provided
    const itemsPayload = items.map((it) => {
      const base: { product_id: number; quantity: number; unit_price?: number; lot_id?: number | null } = {
        product_id: Number(it.product_id),
        quantity: Number(it.quantity),
      };
      if (it.unit_price != null && !Number.isNaN(Number(it.unit_price))) {
        base.unit_price = Number(it.unit_price);
      }
      if (it.lot_id != null) {
        base.lot_id = Number(it.lot_id);
      }
      return base;
    });

    const payload: any = {
      customer_id: Number(customer.id),
      delivery_date: deliveryDate,
      items: itemsPayload, // includes unit_price per line when provided
      status,
    };

    if (appliedDiscount !== '' && appliedDiscount != null) {
      payload.applied_discount = Number(appliedDiscount);
    }

    setSaving(true);
    setLocalError(null);
    try {
      await api.post('/orders/', payload, { headers: { 'Content-Type': 'application/json' } });
      onOpenChange(false);
      onCreated();
    } catch (e: any) {
      const detail = e?.response?.data?.detail ?? e?.response?.data?.message ?? e?.message ?? 'Errore sconosciuto';
      const msg = `Creazione non riuscita: ${String(detail)}`;
      setLocalError(msg);
      onError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Fixed sizes per breakpoint; vertical scroll only; horizontal overflow hidden */}
      <DialogContent
        className="
          w-[calc(100vw-2rem)]
          sm:w-[31rem] md:w-[38rem] lg:w-[48rem] xl:w-[56rem]
          sm:max-w-[31rem] md:max-w-[38rem] lg:max-w-[48rem] xl:max-w-[56rem]
          max-h-[85vh] overflow-y-auto overflow-x-hidden
        "
      >
        <DialogHeader>
          <DialogTitle>Nuovo ordine</DialogTitle>
        </DialogHeader>

        {/* Main form grid; min/max width guards avoid horizontal overflow */}
        <div className="grid gap-4 min-w-0 max-w-full">
          {/* Delivery date */}
          <div className="grid gap-1 min-w-0">
            <Label>Data consegna</Label>
            <DatePicker
              value={deliveryDate}
              onChange={setDeliveryDate}
              placeholder="Seleziona data consegna"
              className="min-w-0 w-full max-w-full"
            />
          </div>

          {/* Customer selector */}
          <div className="grid gap-1 min-w-0">
            <Label>Cliente</Label>
            <SearchCombobox
              value={customer}
              onChange={setCustomer}
              placeholder="Seleziona cliente…"
              endpoint="/customers/list"
              emptyText="Nessun cliente"
            />
          </div>

          {/* Discount percentage */}
          <div className="grid gap-1 min-w-0">
            <Label>Sconto applicato (%)</Label>
            <Input
              type="number"
              step="0.01"
              placeholder="0"
              value={appliedDiscount === '' ? '' : String(appliedDiscount)}
              onChange={(e) => setAppliedDiscount(e.target.value === '' ? '' : Number(e.target.value))}
              className="min-w-0 w-full max-w-full"
            />
          </div>

          {/* Status selector */}
          <div className="grid gap-1 min-w-0">
            <Label>Stato</Label>
            <Select value={status} onValueChange={(v: 'created' | 'delivered') => setStatus(v)}>
              <SelectTrigger className="min-w-0 w-full max-w-full">
                <SelectValue placeholder="Seleziona stato" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created">Da consegnare</SelectItem>
                <SelectItem value="delivered">Consegnato</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Default lot selector */}
          <div className="grid gap-2 min-w-0">
            <Label>Lotto predefinito (opzionale)</Label>
            <LotSelect value={orderLot} onChange={setOrderLot} />
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {orderLot ? (
                <>
                  <span>
                    Applicato automaticamente ai nuovi articoli
                    {orderLot.lot_date ? ` • ${formatLotOptionDate(orderLot.lot_date)}` : ''}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => applyLotToAll(orderLot)}
                  >
                    Applica a tutti gli articoli
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={clearAllLots}>
                    Rimuovi da tutti
                  </Button>
                </>
              ) : (
                <span>Puoi impostare un lotto qui e personalizzarlo per singolo prodotto.</span>
              )}
            </div>
          </div>

          {/* Items editor: supports unit_price editing per line */}
          <div className="grid gap-2 mt-2 rounded-lg border p-3 text-sm min-w-0">
            <Label>Prodotti</Label>
            <div className="h-px bg-border" />
            <ItemsEditor
              items={items}
              onChange={setItems}
              defaultLot={orderLot}
              onApplyLotToAll={applyLotToAll}
            />
          </div>

          {/* Totals preview (client-side estimation) */}
          <div className="mt-2 rounded-lg border p-3 text-sm min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Subtotale</span>
              <span className="tabular-nums">{euro(totals.subtotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Sconto{appliedDiscount ? ` (${appliedDiscount}%)` : ''}</span>
              <span className="tabular-nums">−{euro(totals.discountAmount)}</span>
            </div>
            <div className="mt-1 border-t pt-2 flex items-center justify-between font-medium">
              <span>Totale</span>
              <span className="tabular-nums">{euro(totals.total)}</span>
            </div>
            {totals.hasMissingPrices && (
              <p className="mt-2 text-xs text-muted-foreground">
                Alcuni prezzi unitari non sono disponibili: il totale è parziale.
              </p>
            )}
          </div>

          {/* Non-blocking error message */}
          {localError && <p className="text-sm text-red-600 whitespace-pre-wrap">{localError}</p>}
        </div>

        {/* Footer actions */}
        <DialogFooter className="mt-2 flex flex-row flex-wrap items-center justify-end gap-2">
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
