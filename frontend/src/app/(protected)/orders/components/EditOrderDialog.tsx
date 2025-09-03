'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
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
import { api } from '@/lib/api-client';

import { SearchCombobox } from './SearchCombobox';
import { ItemsEditor } from './ItemsEditor';
import { usePreviewTotals } from '../hooks/usePreviewTotals';
import { euro } from '../utils/currency';
import { Option } from '../types/option';
import { Order, OrderItem } from '../types/order';

/** Robust local number parser (e.g., "1,5" -> 1.5) */
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

/**
 * EditOrderDialog (responsive)
 * - Stable dialog widths; vertical scroll only, x-overflow hidden.
 * - Inputs/selects use min-w-0 to avoid accidental x-overflow.
 * - Footer keeps Delete (left) aligned horizontally with Cancel/Save (right) on mobile.
 * - Sends unit_price per item when provided.
 */
export function EditOrderDialog({
  open, onOpenChange, order, onSaved, onDeleted, onError,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  order: Order | null;
  onSaved: () => void;
  onDeleted: () => void;
  onError: (msg: string) => void;
}) {
  const [loading, setLoading] = React.useState(false);
  const [deliveryDate, setDeliveryDate] = React.useState<string>(order?.delivery_date ?? '');
  const [customer, setCustomer] = React.useState<Option | null>(
    order?.customer_id ? { id: order.customer_id, name: order.customer_name ?? `#${order.customer_id}` } : null
  );
  const [appliedDiscount, setAppliedDiscount] = React.useState<number | ''>(order?.applied_discount ?? '');
  const [status, setStatus] = React.useState<'created' | 'delivered'>(order?.status ?? 'created');
  const [items, setItems] = React.useState<OrderItem[]>(order?.items ?? []);
  const [saving, setSaving] = React.useState(false);
  const [localError, setLocalError] = React.useState<string | null>(null);

  // Confirm delete state + inert cleanup safety
  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);
  const handleConfirmDeleteOpenChange = React.useCallback((o: boolean) => {
    setConfirmDeleteOpen(o);
    if (!o && typeof document !== 'undefined') {
      document.querySelectorAll('[inert]').forEach((el) => el.removeAttribute('inert'));
      (document.body as any).style.pointerEvents = '';
    }
  }, []);

  // Fetch full order on open to keep data fresh
  React.useEffect(() => {
    let ignore = false;
    async function load() {
      if (!open || !order) return;
      setLoading(true);
      setLocalError(null);
      try {
        const res = await api.get<{ status: 'success'; data: Order }>(`/orders/${order.id}`);
        const full = (res.data as any)?.data ?? res.data;
        if (ignore) return;
        setDeliveryDate(full.delivery_date ?? order.delivery_date ?? '');
        setCustomer(
          full.customer_id ? { id: full.customer_id, name: full.customer_name ?? `#${full.customer_id}` } : null
        );
        setAppliedDiscount(full.applied_discount ?? '');
        setStatus(full.status ?? 'created');
        const its: OrderItem[] = Array.isArray(full.items) ? full.items : [];
        setItems(
          its.map((it: any) => ({
            product_id: Number(it.product_id),
            product_name: it.product_name ?? null,
            unit: it.unit ?? null,
            quantity: Number(it.quantity ?? 1),
            unit_price: it.unit_price ?? null,
            total_price: it.total_price ?? null,
          }))
        );
      } catch (e: any) {
        const detail = e?.response?.data?.detail ?? e?.response?.data?.message ?? e?.message ?? 'Errore sconosciuto';
        const msg = `Caricamento ordine non riuscito: ${String(detail)}`;
        setLocalError(msg);
      } finally {
        setLoading(false);
      }
    }
    load();
    return () => {
      (ignore as boolean) = true;
    };
  }, [open, order]);

  // Totals preview (client-side estimate)
  const totals = usePreviewTotals(items, appliedDiscount);

  // Save changes to the API (PATCH)
  async function save() {
    if (!order) return;
    // Basic validations
    if (!deliveryDate) return setLocalError('La data di consegna è obbligatoria.');
    if (!customer?.id) return setLocalError('Il cliente è obbligatorio.');
    if (!items.length) return setLocalError('Aggiungi almeno un prodotto.');

    // Normalize item quantities and optional unit prices
    const itemsPayload = items.map((raw: any) => {
      const qty = parseLocaleNumber(raw.quantity);
      const price = parseLocaleNumber(raw.unit_price);

      return {
        product_id: Number(raw.product_id),
        quantity: qty,
        // include unit_price only when valid (avoid overriding server defaults with null)
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
      delivery_date: deliveryDate,
      customer_id: Number(customer.id),
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
      await api.patch(`/orders/${order.id}`, payload);
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
    if (!order) return;
    setConfirmDeleteOpen(true);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        {/* Fixed sizes per breakpoint; vertical scroll only; horizontal overflow hidden */}
        <DialogContent
          className="
            w-[calc(100vw-2rem)]
            sm:w-[36rem] md:w-[44rem] lg:w-[56rem] xl:w-[64rem]
            max-h-[85vh] overflow-y-auto overflow-x-hidden
          "
        >
          <DialogHeader>
            <DialogTitle>Modifica ordine</DialogTitle>
          </DialogHeader>

          {!order ? (
            <p className="text-sm text-muted-foreground">Nessun ordine selezionato.</p>
          ) : loading ? (
            <div className="space-y-3">
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-5/6" />
              <Skeleton className="h-10 w-2/3" />
            </div>
          ) : (
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

              {/* Customer */}
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

              {/* Discount */}
              <div className="grid gap-1 min-w-0">
                <Label>Sconto applicato (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={appliedDiscount === '' ? '' : String(appliedDiscount)}
                  onChange={(e) => setAppliedDiscount(e.target.value === '' ? '' : Number(e.target.value))}
                  className="min-w-0 w-full max-w-full"
                />
              </div>

              {/* Status */}
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

              {/* Items editor section with divider instead of <br />; avoids layout quirks */}
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
          )}

          {/* Footer: destructive left, actions right; stays horizontal on mobile */}
          <DialogFooter className="mt-2 w-full flex flex-row items-center justify-between gap-2">
            {order && (
              <Button
                variant="destructive"
                onClick={requestDelete}
                className="w-auto"
              >
                Elimina
              </Button>
            )}

            <div className="flex gap-2">
              <DialogClose asChild>
                <Button variant="outline">Annulla</Button>
              </DialogClose>
              <Button onClick={save} disabled={saving || !order}>
                {saving ? 'Salvataggio…' : 'Salva'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={confirmDeleteOpen} onOpenChange={handleConfirmDeleteOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare l’ordine #{order?.id}</AlertDialogTitle>
            <AlertDialogDescription>Questa azione non può essere annullata.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!order) return;
                try {
                  await api.delete(`/orders/${order.id}`);
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