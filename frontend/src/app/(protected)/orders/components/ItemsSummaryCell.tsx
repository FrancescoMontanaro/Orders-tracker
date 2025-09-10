'use client';

import * as React from 'react';
import { OrderItem } from '../types/order';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';

/**
 * Small, legible summary of ordered items as wrapped pills.
 * - Shows max 4 items as pills
 * - "+N" opens a popover with the full list
 * - Prevents overflow on desktop for very long product names
 */
export function ItemsSummaryCell({ items }: { items: OrderItem[] }) {
  if (!items?.length) return <span className="text-muted-foreground">—</span>;
  const MAX = 4;
  const shown = items.slice(0, MAX);
  const extra = Math.max(0, items.length - shown.length);

  function CellPill({ it }: { it: OrderItem }) {
    return (
      <span
        className="inline-flex max-w-full items-center gap-1 rounded-md border bg-muted/40 px-2 py-1 text-xs leading-tight shadow-sm"
        title={`${it.product_name ?? `#${it.product_id}`}${it.unit ? ` (${it.unit})` : ''} × ${it.quantity}`}
      >
        <span className="flex-1 min-w-0 max-w-[180px] whitespace-normal break-words break-all leading-tight">
          {it.product_name ?? `#${it.product_id}`}
          {it.unit ? ` (${it.unit})` : ''}
        </span>
        <span className="shrink-0 inline-flex items-center rounded-sm border bg-background/60 px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap">
          ×{it.quantity}
        </span>
      </span>
    );
  }

  function PopoverPill({ it }: { it: OrderItem }) {
    return (
      <span
        className="inline-flex w-full max-w-full items-center justify-between gap-2 rounded-md border bg-muted/40 px-2 py-1 text-xs leading-tight shadow-sm"
        title={`${it.product_name ?? `#${it.product_id}`}${it.unit ? ` (${it.unit})` : ''} × ${it.quantity}`}
      >
        <span className="flex-1 min-w-0 md:break-all break-words leading-tight">
          {it.product_name ?? `#${it.product_id}`}
          {it.unit ? ` (${it.unit})` : ''}
        </span>
        <span className="shrink-0 inline-flex items-center rounded-sm border bg-background/60 px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap">
          ×{it.quantity}
        </span>
      </span>
    );
  }

  return (
    <div className="min-w-0 flex flex-wrap gap-1.5">
      {shown.map((it, idx) => (
        <CellPill key={idx} it={it} />
      ))}

      {extra > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center rounded-md border bg-muted/40 px-2 py-1 text-xs leading-tight shadow-sm cursor-pointer hover:bg-muted transition-colors"
              aria-label={`Mostra tutti i ${items.length} prodotti`}
              title={`Mostra tutti i ${items.length} prodotti`}
            >
              <span className="underline underline-dotted decoration-muted-foreground/60 font-medium">
                +{extra}
              </span>
            </button>
          </PopoverTrigger>

          <PopoverContent
            side="bottom"
            align="start"
            sideOffset={6}
            collisionPadding={8}
            className="p-2 w-[min(92vw,26rem)] max-h-[70vh] overflow-auto overscroll-contain"
          >
            <div className="px-1 pb-2 text-xs font-medium text-muted-foreground">
              Prodotti ({items.length})
            </div>
            <div className="flex flex-col gap-1.5">
              {items.map((it, idx) => (
                <PopoverPill key={idx} it={it} />
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}