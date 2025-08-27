'use client';

import * as React from 'react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import ItemsEditor from './ItemsEditor';
import SearchCombobox from './SearchCombobox';
import { usePreviewTotals } from '../hooks/usePreviewTotals';
import { useFixRadixInertLeak } from '../hooks/useFixRadixInertLeak';
import type { Option } from '../types/option';
import type { OrderItem } from '../types/dailySummary';
import { euro } from '../utils/currency';
import { fmtDate } from '../utils/date';

// Modal dialog to create a new order; does not send unit prices (server computes totals)
export default function AddOrderDialog({
  open, onOpenChange, onCreated, defaultDate,
}: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: () => void; defaultDate?: string; }) {
  useFixRadixInertLeak();

  const [deliveryDate, setDeliveryDate] = React.useState<string>(defaultDate || '');
  const [customer, setCustomer] = React.useState<Option | null>(null);
  const [appliedDiscount, setAppliedDiscount] = React.useState<number | ''>('');
  const [status, setStatus] = React.useState<'created' | 'delivered'>('created');
  const [items, setItems] = React.useState<OrderItem[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [localError, setLocalError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      // Reset form when dialog opens; keep deliveryDate pre-filled and not editable
      setDeliveryDate(defaultDate || '');
      setCustomer(null);
      setAppliedDiscount('');
      setStatus('created');
      setItems([]);
      setLocalError(null);
    }
  }, [open, defaultDate]);

  const totals = usePreviewTotals(items, appliedDiscount);

  async function create() {
    // Client-side validation keeps the UX responsive
    if (!deliveryDate) return setLocalError('La data di consegna è obbligatoria.');
    if (!customer?.id) return setLocalError('Il cliente è obbligatorio.');
    if (!items.length) return setLocalError('Aggiungi almeno un prodotto.');

    const payload: any = {
      customer_id: Number(customer.id),
      delivery_date: deliveryDate,
      items: items.map((it) => ({ product_id: Number(it.product_id), quantity: Number(it.quantity) })),
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
      setLocalError(`Creazione non riuscita: ${String(detail)}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/*
        Fixed widths per breakpoint (stable):
        - Mobile: clamp to viewport minus margins.
        - Desktop: explicit width at each breakpoint prevents growth when content changes.
        - Horizontal overflow disabled on small screens.
      */}
      <DialogContent
        className="
          w-[calc(100vw-2rem)]            /* full width minus margin on mobile */
          sm:w-[36rem] md:w-[44rem]       /* ~576px, ~704px */
          lg:w-[56rem] xl:w-[64rem]       /* ~896px, ~1024px */
          2xl:w-[72rem]                   /* ~1152px on very large screens */
          max-h-[85vh] overflow-y-auto overflow-x-hidden
        "
      >
        <DialogHeader><DialogTitle>Nuovo ordine</DialogTitle></DialogHeader>

        {/* Main form grid; min-w-0/max-w-full keep children from pushing width */}
        <div className="grid gap-4 min-w-0 max-w-full">
          {/* Readonly delivery date (pre-filled, not editable) */}
          <div className="grid gap-1 min-w-0">
            <Label>Data consegna</Label>
            <Badge>{fmtDate(deliveryDate)}</Badge>
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
            <input
              type="number"
              step="0.01"
              placeholder="0"
              value={appliedDiscount === '' ? '' : String(appliedDiscount)}
              onChange={(e) => setAppliedDiscount(e.target.value === '' ? '' : Number(e.target.value))}
              className="min-w-0 w-full max-w-full h-9 rounded-md border bg-background px-3 py-1 text-sm"
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

          {/* Items editor: mobile-friendly cards; desktop uses horizontal grid inside */}
          <div className="grid gap-2 mt-2 rounded-lg border p-3 text-sm">
            <Label>Prodotti</Label>
            <hr></hr>
            <ItemsEditor items={items} onChange={setItems} />
          </div>

          {/* Totals preview */}
          <div className="mt-2 rounded-lg border p-3 text-sm">
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
              <p className="mt-2 text-xs text-muted-foreground">Alcuni prezzi unitari non sono disponibili: il totale è parziale.</p>
            )}
          </div>

          {localError && <p className="text-sm text-red-600 whitespace-pre-wrap">{localError}</p>}
        </div>

        {/* Footer: side-by-side, not full-width, right-aligned */}
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