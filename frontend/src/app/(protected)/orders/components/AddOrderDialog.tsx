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

/**
 * AddOrderDialog (responsive)
 * - Stable width per breakpoint to avoid layout jumps.
 * - Vertical scroll only; horizontal overflow is explicitly hidden.
 * - All inputs/selects use min-w-0 to prevent accidental x-overflow.
 * - Footer keeps actions aligned horizontally on mobile too.
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

  React.useEffect(() => {
    if (open) {
      setDeliveryDate('');
      setCustomer(null);
      setAppliedDiscount('');
      setStatus('created');
      setItems([]);
      setLocalError(null);
    }
  }, [open]);

  const totals = usePreviewTotals(items, appliedDiscount);

  async function create() {
    // Client-side validations for quick UX
    if (!deliveryDate) return setLocalError('La data di consegna è obbligatoria.');
    if (!customer?.id) return setLocalError('Il cliente è obbligatorio.');
    if (!items.length) return setLocalError('Aggiungi almeno un prodotto.');

    const payload: any = {
      customer_id: Number(customer.id),
      delivery_date: deliveryDate,
      items: items.map((it) => ({ product_id: Number(it.product_id), quantity: Number(it.quantity) })), // unit_price not sent
      status,
    };
    if (appliedDiscount !== '' && appliedDiscount != null) payload.applied_discount = Number(appliedDiscount);

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
      {/* Stable sizes per breakpoint; y-scroll only; explicit x-hidden */}
      <DialogContent
        className="
          w-[calc(100vw-2rem)]
          sm:w-[36rem] md:w-[44rem] lg:w-[56rem] xl:w-[64rem]
          max-h-[85vh] overflow-y-auto overflow-x-hidden
        "
      >
        <DialogHeader>
          <DialogTitle>Nuovo ordine</DialogTitle>
        </DialogHeader>

        {/* Main form grid; min-w-0 / max-w-full avoid horizontal overflow */}
        <div className="grid gap-4 min-w-0 max-w-full">
          <div className="grid gap-1 min-w-0">
            <Label>Data consegna</Label>
            <DatePicker
              value={deliveryDate}
              onChange={setDeliveryDate}
              placeholder="Seleziona data consegna"
              className="min-w-0 w-full max-w-full"
            />
          </div>

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

          {/* Items editor: mobile-friendly; no <br/>, use a divider to keep structure clean */}
          <div className="grid gap-2 mt-2 rounded-lg border p-3 text-sm min-w-0">
            <Label>Prodotti</Label>
            <div className="h-px bg-border" />
            <ItemsEditor items={items} onChange={setItems} />
          </div>

          {/* Totals preview */}
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

          {localError && <p className="text-sm text-red-600 whitespace-pre-wrap">{localError}</p>}
        </div>

        {/* Footer: buttons stay horizontal on small screens; wrap gracefully if needed */}
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