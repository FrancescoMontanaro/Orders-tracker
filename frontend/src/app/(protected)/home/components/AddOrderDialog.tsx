'use client';

import * as React from 'react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { PackagePlus, Plus, X } from 'lucide-react';
import { formatUnit } from '@/lib/utils';
import SearchCombobox from './SearchCombobox';
import { usePreviewTotals } from '../hooks/usePreviewTotals';
import { useFixRadixInertLeak } from '../hooks/useFixRadixInertLeak';
import type { Option } from '../types/option';
import type { OrderItem } from '../types/dailySummary';
import { euro } from '../utils/currency';
import { fmtDate } from '../utils/date';
import { LotSelect } from '@/components/lot-select';
import type { LotOption } from '@/types/lot';
import { formatLotOptionDate } from '@/types/lot';

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

/** Sub-dialog: card-based product editor + lot selector + totals preview */
function OrderProductsDialog({
  open,
  onOpenChange,
  items,
  onItemsChange,
  orderLot,
  onOrderLotChange,
  appliedDiscount,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  items: OrderItem[];
  onItemsChange: (items: OrderItem[]) => void;
  orderLot: LotOption | null;
  onOrderLotChange: (lot: LotOption | null) => void;
  appliedDiscount: number | '';
}) {
  const normalizedItems = React.useMemo(
    () =>
      items.map((it: any) => ({
        ...it,
        quantity: parseLocaleNumber(it.quantity) ?? it.quantity,
        unit_price: parseLocaleNumber(it.unit_price) ?? it.unit_price,
      })),
    [items]
  );
  const totals = usePreviewTotals(normalizedItems as any, appliedDiscount);

  function updateAt(i: number, patch: Partial<OrderItem>) {
    const next = [...items];
    next[i] = { ...next[i], ...patch };
    onItemsChange(next);
  }
  function removeAt(i: number) {
    const next = items.slice();
    next.splice(i, 1);
    onItemsChange(next);
  }
  function lotPatch(lot?: LotOption | null) {
    if (!lot) return { lot_id: null, lot_name: null, lot_date: null, lot_location: null };
    return { lot_id: lot.id, lot_name: lot.name, lot_date: lot.lot_date ?? null, lot_location: lot.location ?? null };
  }
  function addItem() {
    onItemsChange([
      ...items,
      { product_id: 0, product_name: '', unit: null, quantity: 1, unit_price: null, ...lotPatch(orderLot) } as OrderItem,
    ]);
  }

  const applyLotToAll = React.useCallback(
    (lot: LotOption | null) => {
      onItemsChange(items.map((item) => ({ ...item, ...lotPatch(lot) })));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, onItemsChange]
  );

  const clearAllLots = React.useCallback(() => {
    applyLotToAll(null);
    onOrderLotChange(null);
  }, [applyLotToAll, onOrderLotChange]);

  function handleLotChange(lot: LotOption | null) {
    onOrderLotChange(lot);
    if (!lot) return;
    onItemsChange(items.map((item) => (item.lot_id ? item : { ...item, ...lotPatch(lot) })));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="
          w-[calc(100vw-2rem)]
          sm:w-[36rem] md:w-[44rem]
          sm:max-w-[36rem] md:max-w-[44rem]
          max-h-[90vh] flex flex-col overflow-hidden
        "
      >
        <DialogHeader className="shrink-0">
          <DialogTitle>Prodotti e lotti</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-4 pr-1 pb-1">
          {/* ── Lot card ── */}
          <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Lotto predefinito</Label>
              {orderLot && (
                <Button
                  type="button" variant="ghost" size="sm"
                  className="h-7 text-xs text-muted-foreground px-2"
                  onClick={clearAllLots}
                >
                  Rimuovi da tutti
                </Button>
              )}
            </div>
            <LotSelect value={orderLot} onChange={handleLotChange} />
            {orderLot ? (
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground">
                  {[orderLot.lot_date ? formatLotOptionDate(orderLot.lot_date) : null]
                    .filter(Boolean).join(' • ')}
                </span>
                <Button
                  type="button" variant="outline" size="sm"
                  className="h-7 text-xs shrink-0"
                  onClick={() => applyLotToAll(orderLot)}
                >
                  Applica a tutti i prodotti
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Opzionale — viene assegnato automaticamente ai nuovi prodotti.
              </p>
            )}
          </div>

          {/* ── Products list ── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Prodotti</Label>
              {items.length > 0 && <Badge variant="secondary">{items.length}</Badge>}
            </div>

            {items.length === 0 && (
              <p className="text-sm text-muted-foreground">Nessun prodotto. Aggiungine almeno uno.</p>
            )}

            {items.map((it, i) => {
              const normPrice = parseLocaleNumber(it.unit_price);
              const normQty = Number(it.quantity ?? 0);
              const itemTotal =
                normPrice != null && normPrice > 0 && normQty > 0
                  ? normPrice * normQty
                  : null;
              return (
                <div key={i} className="rounded-lg border p-3 space-y-3">
                  {/* Card header */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Prodotto {i + 1}</span>
                    <Button
                      type="button" variant="ghost" size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeAt(i)}
                      aria-label="Rimuovi prodotto"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {/* Product selector */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Prodotto</Label>
                    <SearchCombobox
                      value={it.product_id ? { id: it.product_id, name: it.product_name ?? `#${it.product_id}`, unit_price: it.unit_price ?? null, unit: it.unit ?? null } : null}
                      onChange={(opt) => {
                        if (!opt) return;
                        updateAt(i, { product_id: opt.id, product_name: opt.name, unit_price: opt.unit_price ?? null, unit: opt.unit ?? null });
                      }}
                      placeholder="Seleziona prodotto…"
                      endpoint="/products/list"
                      emptyText="Nessun prodotto"
                    />
                  </div>

                  {/* Lot selector */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Lotto</Label>
                    <LotSelect
                      value={it.lot_id ? { id: Number(it.lot_id), name: it.lot_name ?? `Lotto #${it.lot_id}`, lot_date: it.lot_date ?? '', location: it.lot_location ?? '' } : null}
                      onChange={(lot) => updateAt(i, lotPatch(lot) as Partial<OrderItem>)}
                      placeholder="Nessun lotto"
                    />
                  </div>

                  {/* Price + Qty — 2-column */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">
                        Prezzo{it.unit ? ` (€/${formatUnit(it.unit)})` : ' (€)'}
                      </Label>
                      <Input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min={0}
                        placeholder="0.00"
                        value={it.unit_price == null || String(it.unit_price) === '' ? '' : String(it.unit_price)}
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (raw === '') { updateAt(i, { unit_price: null } as Partial<OrderItem>); return; }
                          updateAt(i, { unit_price: raw as any } as Partial<OrderItem>);
                        }}
                        className="min-w-0 w-full"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">
                        Quantità{it.unit ? ` (${formatUnit(it.unit)})` : ''}
                      </Label>
                      <Input
                        type="number"
                        inputMode="decimal"
                        step="0.001"
                        min={0.001}
                        placeholder="0"
                        value={it.quantity == null ? '' : String(it.quantity)}
                        onChange={(e) => updateAt(i, { quantity: e.target.value as any })}
                        className="min-w-0 w-full"
                      />
                    </div>
                  </div>

                  {/* Per-item total */}
                  {itemTotal !== null && (
                    <div className="flex justify-end text-xs text-muted-foreground border-t pt-2">
                      Totale riga:{' '}
                      <span className="ml-1 font-medium text-foreground tabular-nums">{euro(itemTotal)}</span>
                    </div>
                  )}
                </div>
              );
            })}

            <Button type="button" variant="outline" className="w-full" onClick={addItem}>
              <Plus className="mr-2 h-4 w-4" />
              Aggiungi prodotto
            </Button>
          </div>

          {/* ── Order totals ── */}
          {items.length > 0 && (
            <div className="rounded-lg border p-3 text-sm space-y-1.5">
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Subtotale</span>
                <span className="tabular-nums">{euro(totals.subtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Sconto{appliedDiscount ? ` (${appliedDiscount}%)` : ''}</span>
                <span className="tabular-nums">−{euro(totals.discountAmount)}</span>
              </div>
              <div className="border-t pt-2 flex items-center justify-between font-medium">
                <span>Totale</span>
                <span className="tabular-nums">{euro(totals.total)}</span>
              </div>
              {totals.hasMissingPrices && (
                <p className="text-xs text-muted-foreground">* Totale parziale: alcuni prezzi non disponibili.</p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="mt-3 shrink-0">
          <Button onClick={() => onOpenChange(false)}>Conferma</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AddOrderDialog({
  open, onOpenChange, onCreated, defaultDate,
}: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: () => void; defaultDate?: string; }) {
  useFixRadixInertLeak();

  const [deliveryDate, setDeliveryDate] = React.useState<string>(defaultDate || '');
  const [customer, setCustomer] = React.useState<Option | null>(null);
  const [appliedDiscount, setAppliedDiscount] = React.useState<number | ''>('');
  const [status, setStatus] = React.useState<'created' | 'delivered'>('created');
  const [note, setNote] = React.useState<string>('');
  const [items, setItems] = React.useState<OrderItem[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [localError, setLocalError] = React.useState<string | null>(null);
  const [orderLot, setOrderLot] = React.useState<LotOption | null>(null);
  const [productsOpen, setProductsOpen] = React.useState(false);

  const normalizedItemsForPreview = React.useMemo(
    () =>
      items.map((it: any) => ({
        ...it,
        quantity: parseLocaleNumber(it.quantity) ?? it.quantity,
        unit_price: parseLocaleNumber(it.unit_price) ?? it.unit_price,
      })),
    [items]
  );
  const summaryTotals = usePreviewTotals(normalizedItemsForPreview as any, appliedDiscount);

  // Reset form state when the dialog opens (keep defaultDate pre-filled)
  React.useEffect(() => {
    if (open) {
      setDeliveryDate(defaultDate || '');
      setCustomer(null);
      setAppliedDiscount('');
      setStatus('created');
      setNote('');
      setItems([]);
      setLocalError(null);
      setOrderLot(null);
      setProductsOpen(false);
    }
  }, [open, defaultDate]);

  async function create() {
    if (saving) return;
    if (!deliveryDate) return setLocalError('La data di consegna è obbligatoria.');
    if (!customer?.id) return setLocalError('Il cliente è obbligatorio.');
    if (!items.length) return setLocalError('Aggiungi almeno un prodotto.');

    const itemsPayload = items.map((raw: any) => {
      const qty = parseLocaleNumber(raw.quantity);
      const price = parseLocaleNumber(raw.unit_price);
      return {
        product_id: Number(raw.product_id),
        quantity: qty,
        ...(price != null && Number.isFinite(price) && price >= 0 ? { unit_price: price } : {}),
        ...(raw.lot_id != null ? { lot_id: Number(raw.lot_id) } : {}),
      } as { product_id: number; quantity: number | null; unit_price?: number; lot_id?: number };
    });

    if (itemsPayload.some((it) => it.quantity == null || !Number.isFinite(it.quantity as number) || (it.quantity as number) <= 0)) {
      return setLocalError('Quantità non valida in uno o più prodotti. Usa numeri (es. 1,5).');
    }

    const normalizedDiscount = parseLocaleNumber(appliedDiscount as any);
    if (appliedDiscount !== '' && normalizedDiscount == null) {
      return setLocalError('Sconto non valido. Usa numeri (es. 12,5).');
    }

    const payload: any = {
      customer_id: Number(customer.id),
      delivery_date: deliveryDate,
      items: itemsPayload.map(({ product_id, quantity, unit_price, lot_id }) => ({
        product_id,
        quantity: Number(quantity),
        ...(unit_price != null ? { unit_price: Number(unit_price) } : {}),
        ...(lot_id != null ? { lot_id: Number(lot_id) } : {}),
      })),
      status,
    };
    if (normalizedDiscount != null) payload.applied_discount = normalizedDiscount;
    if (note.trim()) payload.note = note.trim();

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
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="
            w-[calc(100vw-2rem)]
            sm:w-[31rem] md:w-[38rem]
            sm:max-w-[31rem] md:max-w-[38rem]
            max-h-[85vh] overflow-y-auto overflow-x-hidden
          "
        >
          <DialogHeader><DialogTitle>Nuovo ordine</DialogTitle></DialogHeader>

          <div className="grid gap-4 min-w-0 max-w-full">
            {/* Readonly delivery date (pre-filled) */}
            <div className="grid gap-1 min-w-0">
              <Label>Data consegna</Label>
              <Badge className="w-fit">{fmtDate(deliveryDate)}</Badge>
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

            {/* Note */}
            <div className="grid gap-1 min-w-0">
              <Label>Note (opzionale)</Label>
              <Textarea
                placeholder="Aggiungi una nota all'ordine…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="min-w-0 w-full max-w-full resize-none"
                rows={2}
              />
            </div>

            {/* Products summary */}
            <div className="grid gap-2 min-w-0">
              <div className="flex items-center justify-between">
                <Label>Prodotti</Label>
                {items.length > 0 && (
                  <Badge variant="secondary">{items.length}</Badge>
                )}
              </div>
              {items.length > 0 ? (
                <div className="rounded-lg border divide-y text-sm">
                  {(items as any[]).map((it, i) => {
                    const normPrice = parseLocaleNumber(it.unit_price);
                    const qty = Number(it.quantity ?? 0);
                    const itemTotal =
                      normPrice != null && normPrice > 0 && qty > 0
                        ? normPrice * qty
                        : null;
                    return (
                      <div key={i} className="px-3 py-2.5 space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-medium leading-tight">
                            {it.product_name ?? `Prodotto #${it.product_id}`}
                          </span>
                          <span className="text-muted-foreground shrink-0 text-xs mt-0.5">
                            × {qty}{it.unit ? ` ${formatUnit(it.unit)}` : ''}
                          </span>
                        </div>
                        {it.lot_name && (
                          <div className="text-xs text-muted-foreground">
                            Lotto: <span className="text-foreground">{it.lot_name}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="text-muted-foreground">
                            {normPrice != null
                              ? `€${normPrice.toFixed(2)}${it.unit ? `/${formatUnit(it.unit)}` : ''}`
                              : 'Prezzo non disponibile'}
                          </span>
                          {itemTotal !== null && (
                            <span className="font-medium tabular-nums">= {euro(itemTotal)}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {/* Order totals row */}
                  <div className="px-3 py-2.5 space-y-1 bg-muted/30">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Subtotale</span>
                      <span className="tabular-nums">{euro(summaryTotals.subtotal)}</span>
                    </div>
                    {(appliedDiscount !== '' && Number(appliedDiscount) > 0) && (
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Sconto ({appliedDiscount}%)</span>
                        <span className="tabular-nums">−{euro(summaryTotals.discountAmount)}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-sm font-medium border-t pt-1 mt-0.5">
                      <span>Totale</span>
                      <span className="tabular-nums">{euro(summaryTotals.total)}</span>
                    </div>
                    {summaryTotals.hasMissingPrices && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">* Totale parziale</p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nessun prodotto aggiunto.</p>
              )}
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setProductsOpen(true)}
              >
                <PackagePlus className="mr-2 h-4 w-4" />
                {items.length > 0 ? 'Modifica prodotti e lotti' : 'Aggiungi prodotti e lotti'}
              </Button>
            </div>

            {localError && <p className="text-sm text-red-600 whitespace-pre-wrap">{localError}</p>}
          </div>

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

      <OrderProductsDialog
        open={productsOpen}
        onOpenChange={setProductsOpen}
        items={items}
        onItemsChange={setItems}
        orderLot={orderLot}
        onOrderLotChange={setOrderLot}
        appliedDiscount={appliedDiscount}
      />
    </>
  );
}

