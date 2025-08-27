'use client';

import * as React from 'react';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandItem, CommandEmpty } from '@/components/ui/command';
import { ChevronsUpDown, Check } from 'lucide-react';
import type { Option } from '../types/option';
import type { SuccessResponse } from '../types/dailySummary';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

type Pagination<T> = { total: number; items: T[] };

export function useRemoteSearch(endpoint: '/customers/list' | '/products/list') {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const debounced = useDebouncedValue(query, 250);
  const [options, setOptions] = React.useState<Option[]>([]);
  const [loading, setLoading] = React.useState(false);

  const fetchOptions = React.useCallback(async () => {
    if (!open) return;
    setLoading(true);
    try {
      const body: any = {
        filters: { is_active: true },
        sort: [{ field: 'name', order: 'asc' }],
      };
      if (debounced.trim()) body.filters.name = debounced.trim();

      const res = await api.post<SuccessResponse<Pagination<any>>>(endpoint, body, {
        headers: { 'Content-Type': 'application/json' },
      });
      const payload = (res.data as any)?.data ?? res.data;
      const list = Array.isArray(payload.items) ? payload.items : [];

      setOptions(
        list.map((x: any) =>
          endpoint === '/products/list'
            ? { id: Number(x.id), name: String(x.name), unit_price: x.unit_price ?? null, unit: x.unit ?? null }
            : { id: Number(x.id), name: String(x.name) }
        )
      );
    } finally {
      setLoading(false);
    }
  }, [endpoint, debounced, open]);

  React.useEffect(() => { fetchOptions(); }, [fetchOptions]);
  React.useEffect(() => { if (open && !debounced) fetchOptions(); }, [open]); // eslint-disable-line

  return { open, setOpen, query, setQuery, options, loading };
}

export default function SearchCombobox({
  value, onChange, placeholder, endpoint, emptyText = 'Nessun risultato',
}: {
  value: Option | null;
  onChange: (opt: Option | null) => void;
  placeholder: string;
  endpoint: '/customers/list' | '/products/list';
  emptyText?: string;
}) {
  const { open, setOpen, query, setQuery, options, loading } = useRemoteSearch(endpoint);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {/* Trigger is shrinkable and x-safe on mobile */}
        <Button
          type="button"
          variant="outline"
          role="combobox"
          className="min-w-0 w-full max-w-full justify-between"
        >
          <span className="truncate">{value ? value.name : placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>

      {/* Scrollable popover; width matches trigger, clamped to viewport */}
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width] max-w-[calc(100vw-2rem)] max-h-[60vh] overflow-y-auto">
        <Command>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Digita per cercare…"
          />
          <CommandList className="max-h-[50vh] overflow-y-auto">
            {loading ? (
              <div className="p-3 text-sm text-muted-foreground">Caricamento…</div>
            ) : options.length ? (
              options.map((opt) => (
                <CommandItem
                  key={opt.id}
                  value={opt.name}
                  onMouseDown={(e) => e.preventDefault()} // keep focus within dialog
                  onSelect={() => {
                    onChange(opt);
                    setOpen(false);
                    setQuery('');
                  }}
                  className="whitespace-nowrap"
                >
                  <Check className={cn('mr-2 h-4 w-4', value?.id === opt.id ? 'opacity-100' : 'opacity-0')} />
                  {opt.name}
                </CommandItem>
              ))
            ) : (
              <CommandEmpty>{emptyText}</CommandEmpty>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}