'use client';

import { useId } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { DiscountType } from '@/lib/order-pricing';

/** Shared percent/euro input for creating and editing orders. */
export function OrderDiscountField({
  value,
  discountType,
  onValueChange,
  onTypeChange,
  error,
}: {
  value: number | '';
  discountType: DiscountType;
  onValueChange: (value: number | '') => void;
  onTypeChange: (value: DiscountType) => void;
  error?: string | null;
}) {
  const id = useId();

  return (
    <div className="grid gap-1 min-w-0">
      <Label htmlFor={id}>Sconto applicato</Label>
      <div className="flex gap-2 min-w-0">
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          min={0}
          max={discountType === 'percentage' ? 100 : undefined}
          step="0.01"
          placeholder="0"
          value={value}
          onChange={(event) => onValueChange(event.target.value === '' ? '' : Number(event.target.value))}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          className="min-w-0 flex-1"
        />
        <Select value={discountType} onValueChange={onTypeChange}>
          <SelectTrigger aria-label="Tipo di sconto" className="w-20 shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="percentage">%</SelectItem>
            <SelectItem value="fixed">€</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {error && <p id={`${id}-error`} role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
