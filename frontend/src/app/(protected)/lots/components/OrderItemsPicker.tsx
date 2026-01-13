'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { formatUnit } from '@/lib/utils';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { useOrderItemsOptions } from '../hooks/useOrderItemsOptions';
import type { OrderOption, LotOrderItem } from '../types/lot';
import { formatLotDate } from '../utils/date';

export type ItemSelection = {
  itemIds: number[];
};

type OrderItemsPickerProps = {
  dialogOpen: boolean;
  value: ItemSelection;
  onChange: (selection: ItemSelection) => void;
  initialOrderIds?: number[];
  selectedItemsSnapshot?: LotOrderItem[];
};

export function OrderItemsPicker({
  dialogOpen,
  value,
  onChange,
  initialOrderIds = [],
  selectedItemsSnapshot = [],
}: OrderItemsPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [localError, setLocalError] = React.useState<string | null>(null);

  const {
    orders,
    loading,
    error,
    search,
    setSearch,
    refetch,
    ensureOrders,
    page,
    size,
    total,
    setPage,
    setSize,
  } = useOrderItemsOptions(dialogOpen && open, initialOrderIds);

  const selectedSet = React.useMemo(() => new Set(value.itemIds), [value.itemIds]);

  // Ensure orders required by current selection are loaded
  React.useEffect(() => {
    if (!dialogOpen) return;
    const orderIds = Array.from(
      new Set(
        selectedItemsSnapshot.map((item) => item.order_id).filter((id): id is number => typeof id === 'number')
      )
    );
    if (orderIds.length) ensureOrders(orderIds);
  }, [dialogOpen, selectedItemsSnapshot, ensureOrders]);

  const mergedOrders = React.useMemo(() => {
    const map = new Map<number, OrderOption>();
    orders.forEach((order) => {
      map.set(order.id, {
        ...order,
        items: Array.isArray(order.items) ? [...order.items] : [],
      });
    });

    selectedItemsSnapshot.forEach((item) => {
      if (!selectedSet.has(item.id)) return;
      const orderId = item.order_id;
      if (typeof orderId !== 'number') return;

      if (!map.has(orderId)) {
        map.set(orderId, {
          id: orderId,
          customer_id: item.customer_id ?? 0,
          customer_name: item.customer_name ?? `Cliente #${item.customer_id ?? 'n/d'}`,
          delivery_date: '',
          items: [],
        });
      }

      const target = map.get(orderId)!;
      if (target.items.every((existing) => existing.id !== item.id)) {
        target.items.push({
          id: item.id,
          product_id: item.product_id,
          product_name: item.product_name,
          unit: item.product_unit,
          quantity: item.quantity,
        });
      }
    });

    return Array.from(map.values());
  }, [orders, selectedItemsSnapshot, selectedSet]);

  const groupedSummary = React.useMemo(() => {
    const summary = new Map<number, { order: OrderOption; items: OrderOption['items'] }>();
    mergedOrders.forEach((order) => {
      const filtered = order.items.filter((item) => selectedSet.has(item.id));
      if (filtered.length) {
        summary.set(order.id, { order, items: filtered });
      }
    });
    return summary;
  }, [mergedOrders, selectedSet]);

  const selectedCount = selectedSet.size;
  const orderCount = groupedSummary.size;

  const summaryLabel = React.useMemo(() => {
    if (!selectedCount) return 'Seleziona ordini o prodotti';
    const ordersLabel = orderCount === 1 ? '1 ordine' : `${orderCount} ordini`;
    return `${ordersLabel} · ${selectedCount} prodotti`;
  }, [selectedCount, orderCount]);

  function toggleOrder(order: OrderOption, checked: boolean) {
    const next = new Set(selectedSet);
    if (checked) {
      order.items.forEach((item) => next.add(item.id));
    } else {
      order.items.forEach((item) => next.delete(item.id));
    }
    onChange({ itemIds: Array.from(next) });
  }

  function toggleItem(order: OrderOption, itemId: number, checked: boolean) {
    const next = new Set(selectedSet);
    if (checked) next.add(itemId);
    else next.delete(itemId);
    onChange({ itemIds: Array.from(next) });
  }

  function orderCheckboxState(order: OrderOption) {
    const total = order.items.length;
    if (!total) return { checked: false, indeterminate: false };
    const selected = order.items.filter((item) => selectedSet.has(item.id)).length;
    if (selected === total) return { checked: true, indeterminate: false };
    if (selected === 0) return { checked: false, indeterminate: false };
    return { checked: true, indeterminate: true };
  }

  return (
    <div className="grid gap-2">
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) {
            setPage(1);
            setLocalError(null);
          } else {
            setSearch('');
          }
        }}
      >
        <DialogTrigger asChild>
          <Button type="button" variant="outline" className="justify-between w-full">
            <span className="truncate">{summaryLabel}</span>
            <span className="text-xs text-muted-foreground ml-2 shrink-0">Gestisci</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="w-[min(92vw,40rem)] max-h-[82vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Associa ordini / prodotti</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-3 flex-1 min-h-0">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Cerca per cliente..."
                className="flex-1"
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSearch('');
                    setPage(1);
                    refetch();
                  }}
                >
                  Reset
                </Button>
                <Button type="button" variant="outline" onClick={() => onChange({ itemIds: [] })}>
                  Svuota selezione
                </Button>
              </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            {localError && <p className="text-sm text-red-600">{localError}</p>}

            <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-3">
              {loading && (
                <p className="text-sm text-muted-foreground">Caricamento ordini…</p>
              )}

              {!loading && orders.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Nessun ordine trovato per la ricerca corrente.
                </p>
              )}

              {orders.map((order) => {
                const state = orderCheckboxState(order);
                const customerLabel = order.customer_name
                  ? `${order.customer_name}`
                  : `Cliente #${order.customer_id}`;
                const orderLabel = `Ordine #${order.id} · ${order.items.length} prodotti · ${formatLotDate(
                  order.delivery_date
                )}`;

                return (
                  <div key={order.id} className="rounded-md border p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 min-w-0">
                        <div className="text-sm font-medium leading-tight break-words">
                          {customerLabel}
                        </div>
                        <div className="text-xs text-muted-foreground leading-tight break-words">
                          {orderLabel}
                        </div>
                      </div>
                      <Checkbox
                        checked={state.checked}
                        onCheckedChange={(v) => {
                          if (order.items.length === 0) {
                            setLocalError("L'ordine selezionato non contiene prodotti.");
                            return;
                          }
                          toggleOrder(order, !!v);
                        }}
                        aria-label={`Seleziona tutti gli prodotti dell'ordine ${order.id}`}
                        data-indeterminate={state.indeterminate ? 'true' : undefined}
                      />
                    </div>

                    <Separator />

                    <div className="grid gap-2 pl-2">
                      {order.items.map((item) => (
                        <label key={item.id} className="flex items-start gap-2 text-sm">
                          <Checkbox
                            checked={selectedSet.has(item.id)}
                            onCheckedChange={(v) => toggleItem(order, item.id, !!v)}
                            aria-label={`Seleziona articolo ${item.id}`}
                          />
                          <div className="min-w-0">
                            <div className="font-medium leading-tight break-words">
                              {item.product_name ?? `Prodotto #${item.product_id}`}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Articolo ordine: #{item.id} · Quantità: {item.quantity} {formatUnit(item.unit)}
                            </div>
                            {item.lot_id ? (
                              <div className="text-xs text-muted-foreground">
                                Lotto: {item.lot_name ?? `#${item.lot_id}`}
                                {item.lot_location ? ` • ${item.lot_location}` : ''}
                              </div>
                            ) : null}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <PaginationControls
              page={page}
              size={size}
              total={total}
              onPrev={() => setPage((p) => Math.max(1, p - 1))}
              onNext={() => setPage((p) => p + 1)}
              onSizeChange={(nextSize) => {
                setSize(nextSize);
                setPage(1);
              }}
              disabled={loading}
            />
          </div>

          <DialogFooter className="mt-2 w-full flex flex-row items-center justify-between gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Chiudi
              </Button>
            </DialogClose>
            <DialogClose asChild>
              <Button type="button" variant="default">
                Applica selezione
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedCount > 0 && (
        <div className="rounded-md border border-muted bg-muted/30 p-2 space-y-2">
          {Array.from(groupedSummary.values()).map(({ order, items }) => (
            <div key={order.id} className="space-y-1">
              <div className="text-xs font-semibold uppercase text-muted-foreground">
                {order.customer_name ?? `Cliente #${order.customer_id}`}
              </div>
              <div className="text-xs text-muted-foreground">
                Ordine #{order.id} · {items.length} prodotti selezionati
              </div>
              <div className="flex flex-wrap gap-1.5">
                {items.map((item) => (
                  <span
                    key={item.id}
                    className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-0.5 text-xs"
                  >
                    <span className="truncate max-w-[160px]">
                      {item.product_name ?? `Prodotto #${item.product_id}`} ({formatUnit(item.unit)})
                    </span>
                    <span className="rounded-sm border px-1 py-[1px] text-[11px]">
                      ×{item.quantity}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
