'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

/**
 * Reusable pagination footer.
 * Pure presentational logic: no behavior change from your original code.
 */
export function PaginationControls({
  page, size, total,
  onPrev, onNext, onSizeChange,
  disabled,
}: {
  page: number;
  size: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  onSizeChange: (s: number) => void;
  disabled?: boolean;
}) {
  const pageCount = Math.max(1, Math.ceil((total || 0) / Math.max(1, size)));
  const canPrev = page > 1;
  const canNext = page < pageCount;
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between min-w-0">
      <div className="text-sm text-muted-foreground">
        Totale: <span className="font-medium">{total}</span> — Pagina {page} di {pageCount}
      </div>
      <div className="flex items-center gap-2">
        <Select value={String(size)} onValueChange={(v) => onSizeChange(Number(v))} disabled={disabled}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Righe" />
          </SelectTrigger>
          <SelectContent>
            {[10, 20, 50].map((n) => (
              <SelectItem key={n} value={String(n)}>{n} / pagina</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" disabled={disabled || !canPrev} onClick={onPrev} className="shrink-0">
          Prec.
        </Button>
        <Button variant="outline" disabled={disabled || !canNext} onClick={onNext} className="shrink-0">
          Succ.
        </Button>
      </div>
    </div>
  );
}