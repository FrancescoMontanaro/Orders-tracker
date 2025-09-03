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

// --- util: robust local number parsing (e.g., "1,5" -> 1.5) ---
function parseLocaleNumber(v: unknown): number | null {
  if (v === '' || v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const s = v.replace(/\s/g, '').replace(',', '.');
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

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

  // Reset form state when the dialog opens (keep defaultDate pre-filled)
  React.useEffect(() => {
    if (open) {
      setDeliveryDate(defaultDate || '');
      setCustomer(null);
      setAppliedDiscount('');
      setStatus('created');
      setItems([]);
      setLocalError(null);
    }
  }, [open, defaultDate]);

  // Normalize items for totals preview (accept comma as decimal separator)
  const normalizedItemsForPreview = React.useMemo(() => {
    return items.map((it: any) => {
      const qty = parseLocaleNumber(it.quantity);
      const price = parseLocaleNumber(it.unit_price);
      return {
        ...it,
        quantity: qty ?? it.quantity,          // keep raw while typing invalid
        unit_price: price ?? it.unit_price,    // keep raw while typing invalid
      };
    });
  }, [items]);

  // Use normalized values to compute totals so mobile users see correct numbers
  const totals = usePreviewTotals(normalizedItemsForPreview as any, appliedDiscount);

  async function create() {
    if (saving) return; // prevent double taps

    // Basic validations
    if (!deliveryDate) return setLocalError('La data di consegna è obbligatoria.');
    if (!customer?.id) return setLocalError('Il cliente è obbligatorio.');
    if (!items.length) return setLocalError('Aggiungi almeno un prodotto.');

    // Build items payload with normalized quantity and optional unit_price
    const itemsPayload = items.map((raw: any) => {
      const qty = parseLocaleNumber(raw.quantity);
      const price = parseLocaleNumber(raw.unit_price);

      return {
        product_id: Number(raw.product_id),
        quantity: qty,
        // include unit_price only when valid (avoid clobbering server defaults)
        ...(price != null && Number.isFinite(price) && price >= 0 ? { unit_price: price } : {}),
      } as { product_id: number; quantity: number | null; unit_price?: number };
    });

    // Validate quantities
    if (itemsPayload.some((it) => it.quantity == null || !Number.isFinite(it.quantity as number) || (it.quantity as number) <= 0)) {
      return setLocalError('Quantità non valida in uno o più prodotti. Usa numeri (es. 1,5).');
    }

    // Normalize discount
    const normalizedDiscount = parseLocaleNumber(appliedDiscount as any);
    if (appliedDiscount !== '' && normalizedDiscount == null) {
      return setLocalError('Sconto non valido. Usa numeri (es. 12,5).');
    }

    const payload: any = {
      customer_id: Number(customer.id),
      delivery_date: deliveryDate,
      // cast quantities to number after validation
      items: itemsPayload.map(({ product_id, quantity, unit_price }) => ({
        product_id,
        quantity: Number(quantity),
        ...(unit_price != null ? { unit_price: Number(unit_price) } : {}),
      })),
      status,
    };
    if (normalizedDiscount != null) payload.applied_discount = normalizedDiscount;

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
      <DialogContent
        className="
          w-[calc(100vw-2rem)]
          sm:w-[36rem] md:w-[44rem]
          lg:w-[56rem] xl:w-[64rem]
          2xl:w-[72rem]
          max-h-[85vh] overflow-y-auto overflow-x-hidden
        "
      >
        <DialogHeader><DialogTitle>Nuovo ordine</DialogTitle></DialogHeader>

        {/* Main form grid; min-w-0/max-w-full keep children from pushing width */}
        <div className="grid gap-4 min-w-0 max-w-full">
          {/* Readonly delivery date (pre-filled, not editable here) */}
          <div className="grid gap-1 min-w-0">
            <Label>Data consegna</Label>
            <Badge>{fmtDate(deliveryDate)}</Badge>
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

          {/* Discount input (locale-friendly) */}
          <div className="grid gap-1 min-w-0">
            <Label>Sconto applicato (%)</Label>
            <input
              type="number"
              inputMode="decimal"
              pattern="[0-9]*[.,]?[0-9]*"
              placeholder="0"
              value={appliedDiscount === '' ? '' : String(appliedDiscount)}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === '') return setAppliedDiscount('');
                const n = parseLocaleNumber(raw);
                setAppliedDiscount(n == null ? '' : n);
              }}
              className="min-w-0 w-full max-w-full h-9 rounded-md border bg-background px-3 py-1 text-sm"
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

          {/* Items editor: mobile-friendly cards; the editor already allows unit_price editing */}
          <div className="grid gap-2 mt-2 rounded-lg border p-3 text-sm">
            <Label>Prodotti</Label>
            <hr />
            <ItemsEditor items={items} onChange={setItems} />
          </div>

          {/* Totals preview */}
          <div className="mt-2 rounded-lg border p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Subtotale</span>
              <span className="tabular-nums">{euro(totals.subtotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">
                Sconto{appliedDiscount ? ` (${appliedDiscount}%)` : ''}
              </span>
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

          {/* Non-blocking error */}
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