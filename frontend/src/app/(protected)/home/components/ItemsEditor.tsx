'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import SearchCombobox from './SearchCombobox';
import type { OrderItem } from '../types/dailySummary';
import { euro } from '../utils/currency';

// Reusable items editor for order dialogs; unit price is display-only, not editable.
export default function ItemsEditor({
  items, onChange,
}: { items: OrderItem[]; onChange: (next: OrderItem[]) => void; }) {
  function updateAt(i: number, patch: Partial<OrderItem>) {
    const next = [...items];
    next[i] = { ...next[i], ...patch };
    onChange(next);
  }
  function removeAt(i: number) {
    const next = items.slice();
    next.splice(i, 1);
    onChange(next);
  }
  function add() {
    onChange([...(items ?? []), { product_id: 0, product_name: '', unit: null, quantity: 1 }]);
  }

  return (
    <div className="grid gap-3 min-w-0 max-w-full">
      {/* Desktop header */}
      <div className="hidden sm:grid sm:grid-cols-12 items-end gap-2">
        {items?.length ? (
          <>
            <div className="col-span-7"><Label>Prodotto</Label></div>
            <div className="col-span-4"><Label>Quantità</Label></div>
            <div className="col-span-1" />
          </>
        ) : null}
      </div>

      {/* Items */}
      {items?.length ? items.map((it, i) => (
        <div
          key={i}
          className="
            rounded-md border p-3 sm:border-0 sm:p-0
            grid gap-3 sm:grid-cols-12 sm:items-center
            min-w-0 max-w-full
          "
        >
          {/* Product field: full width on mobile, col-span on desktop */}
          <div className="min-w-0 sm:col-span-7">
            <div className="sm:hidden mb-2"><Label>Prodotto</Label></div>
            <SearchCombobox
              value={it.product_id ? {
                id: it.product_id,
                name: it.product_name ?? `#${it.product_id}`,
                unit_price: it.unit_price ?? null,
                unit: it.unit ?? null,
              } : null}
              onChange={(opt) => {
                if (!opt) return;
                updateAt(i, {
                  product_id: opt.id,
                  product_name: opt.name,
                  unit_price: opt.unit_price ?? null,
                  unit: opt.unit ?? null,
                });
              }}
              placeholder="Seleziona prodotto…"
              endpoint="/products/list"
              emptyText="Nessun prodotto"
            />
          </div>

          {/* Quantity + remove: compact row on mobile; grid on desktop */}
          <div className="grid grid-cols-[1fr_auto] items-end gap-2 sm:col-span-5 sm:grid-cols-5">
            <div className="col-span-1 sm:col-span-4 min-w-0">
              <div className="sm:hidden mb-2"><Label>Quantità</Label></div>
              <Input
                type="number"
                min={1}
                value={String(it.quantity ?? 1)}
                onChange={(e) => updateAt(i, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                className="min-w-0 w-full max-w-full"
              />
            </div>
            <div className="col-span-1 flex items-end justify-end">
              <Button type="button" variant="ghost" onClick={() => removeAt(i)} aria-label="Rimuovi prodotto">
                ✕
              </Button>
            </div>
          </div>

          {/* Unit price note: full width; subtle on desktop */}
          {(items[i]?.unit_price != null) && (
            <div className="sm:col-span-12 text-xs text-muted-foreground">
              Prezzo unit.: {euro(items[i].unit_price)}{items[i]?.unit ? ` / ${items[i].unit}` : ''}
            </div>
          )}
        </div>
      )) : (
        <p className="text-sm text-muted-foreground">Nessun prodotto. Aggiungine almeno uno.</p>
      )}

      <div><Button type="button" variant="outline" onClick={add}>+ Aggiungi prodotto</Button></div>
    </div>
  );
}