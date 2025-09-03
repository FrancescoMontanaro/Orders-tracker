'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import SearchCombobox from './SearchCombobox';
import type { OrderItem } from '../types/dailySummary';
import { euro } from '../utils/currency';

/** Robust locale number parser (e.g., "1,5" -> 1.5) */
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

/** Reusable items editor for order dialogs; unit price is now editable. */
export default function ItemsEditor({
  items,
  onChange,
}: {
  items: OrderItem[];
  onChange: (next: OrderItem[]) => void;
}) {
  /** Immutable update helper for a specific row */
  function updateAt(i: number, patch: Partial<OrderItem>) {
    const next = [...items];
    next[i] = { ...next[i], ...patch };
    onChange(next);
  }

  /** Remove a row at index */
  function removeAt(i: number) {
    const next = items.slice();
    next.splice(i, 1);
    onChange(next);
  }

  /** Append a new empty row */
  function add() {
    onChange([
      ...(items ?? []),
      { product_id: 0, product_name: '', unit: null, quantity: 1, unit_price: null } as OrderItem,
    ]);
  }

  return (
    <div className="grid gap-3 min-w-0 max-w-full">
      {/* Desktop header */}
      <div className="hidden sm:grid sm:grid-cols-12 items-end gap-2">
        {items?.length ? (
          <>
            <div className="col-span-6">
              <Label>Prodotto</Label>
            </div>
            <div className="col-span-3">
              <Label>Prezzo unitario</Label>
            </div>
            <div className="col-span-3">
              <Label>Quantità</Label>
            </div>
          </>
        ) : null}
      </div>

      {/* Items */}
      {items?.length ? (
        items.map((it, i) => (
          <div
            key={i}
            className="
              rounded-md border p-3 sm:border-0 sm:p-0
              grid gap-3 sm:grid-cols-12 sm:items-center
              min-w-0 max-w-full
            "
          >
            {/* Product field: full width on mobile, col-span on desktop */}
            <div className="min-w-0 sm:col-span-6">
              <div className="sm:hidden mb-2">
                <Label>Prodotto</Label>
              </div>
              <SearchCombobox
                value={
                  it.product_id
                    ? {
                        id: it.product_id,
                        name: it.product_name ?? `#${it.product_id}`,
                        unit_price: (it as any).unit_price ?? null,
                        unit: it.unit ?? null,
                      }
                    : null
                }
                onChange={(opt) => {
                  if (!opt) return;
                  updateAt(i, {
                    product_id: opt.id,
                    product_name: opt.name,
                    unit_price: opt.unit_price ?? null, // prefill from DB
                    unit: opt.unit ?? null,
                  });
                }}
                placeholder="Seleziona prodotto…"
                endpoint="/products/list"
                emptyText="Nessun prodotto"
              />
            </div>

            {/* Unit price editor: editable numeric input with locale-friendly behavior */}
            <div className="sm:col-span-3 min-w-0">
              <div className="sm:hidden mb-2">
                <Label>Prezzo unitario</Label>
              </div>
              <div className="grid grid-cols-[1fr_auto] items-center gap-2">
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min={0}
                  placeholder="0.00"
                  value={
                    (it as any).unit_price == null || Number.isNaN((it as any).unit_price)
                      ? ''
                      : String((it as any).unit_price)
                  }
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === '') {
                      updateAt(i, { unit_price: null } as Partial<OrderItem>);
                      return;
                    }
                    const n = parseLocaleNumber(raw);
                    // Keep previous valid value if input is temporarily invalid while typing
                    if (n == null) return;
                    updateAt(i, { unit_price: n } as Partial<OrderItem>);
                  }}
                  className="min-w-0 w-full max-w-full"
                />
                {/* Unit chip (read-only) */}
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {it?.unit ? `/${it.unit}` : ''}
                </span>
              </div>
            </div>

            {/* Quantity + remove: compact row on mobile; grid on desktop */}
            <div className="grid grid-cols-[1fr_auto] items-end gap-2 sm:col-span-3 sm:grid-cols-3">
              <div className="col-span-1 sm:col-span-2 min-w-0">
                <div className="sm:hidden mb-2">
                  <Label>Quantità{it?.unit ? ` (${it.unit})` : ''}</Label>
                </div>
                <Input
                  type="number"
                  min={1}
                  value={String(it.quantity ?? 1)}
                  onChange={(e) =>
                    updateAt(i, {
                      quantity: Math.max(1, Number(e.target.value) || 1),
                    })
                  }
                  className="min-w-0 w-full max-w-full"
                />
              </div>
              <div className="col-span-1 flex items-end justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => removeAt(i)}
                  aria-label="Rimuovi prodotto"
                >
                  ✕
                </Button>
              </div>
            </div>
          </div>
        ))
      ) : (
        <p className="text-sm text-muted-foreground">Nessun prodotto. Aggiungine almeno uno.</p>
      )}

      <div>
        <Button type="button" variant="outline" onClick={add}>
          + Aggiungi prodotto
        </Button>
      </div>
    </div>
  );
}