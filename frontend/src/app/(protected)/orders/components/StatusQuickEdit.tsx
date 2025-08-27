import * as React from 'react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api-client';

/**
 * Inline status select editor used in the table. Pure client-side, calls PATCH /orders/:id.
 * Visual style is kept distinct (soft colored background + dot).
 */
export function StatusQuickEdit({
  orderId,
  value,
  onChanged,
  onError,
}: {
  orderId: number;
  value: 'created' | 'delivered';
  onChanged: () => void;
  onError: (msg: string) => void;
}) {
  const [pending, setPending] = React.useState(false);

  async function updateStatus(next: 'created' | 'delivered') {
    if (next === value) return;
    setPending(true);
    try {
      await api.patch(`/orders/${orderId}`, { status: next });
      onChanged();
    } catch (e: any) {
      const detail = e?.response?.data?.detail ?? e?.response?.data?.message ?? e?.message ?? 'Errore sconosciuto';
      onError(`Aggiornamento stato non riuscito: ${String(detail)}`);
    } finally {
      setPending(false);
    }
  }

  const styleFor = (v: 'created' | 'delivered') =>
    v === 'delivered'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
      : 'bg-amber-50 text-amber-700 border-amber-300';

  return (
    <Select defaultValue={value} onValueChange={(v) => updateStatus(v as 'created' | 'delivered')} disabled={pending}>
      <SelectTrigger
        className={cn(
          'h-8 px-2 py-0 text-xs justify-start whitespace-nowrap',
          styleFor(value)
        )}
      >
        <SelectValue aria-label={value}>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'h-2.5 w-2.5 rounded-full',
                value === 'delivered' ? 'bg-emerald-500' : 'bg-amber-500'
              )}
            />
            <span>{value === 'delivered' ? 'Consegnato' : 'Da consegnare'}</span>
          </div>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="created">Da consegnare</SelectItem>
        <SelectItem value="delivered">Consegnato</SelectItem>
      </SelectContent>
    </Select>
  );
}