'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandItem, CommandEmpty } from '@/components/ui/command';
import { ChevronsUpDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRemoteSearch, type Option } from '../hooks/useRemoteSearch';

/**
 * Single-select combobox (responsive)
 * - Trigger is full width and truncates long labels.
 * - Popover width equals trigger; content is scrollable to avoid viewport overflow.
 */
export function SearchCombobox({
  value,
  onChange,
  placeholder = 'Cerca…',
  endpoint,
  emptyText = 'Nessun risultato',
  allowClear = false,
  clearLabel = 'Tutti',
}: {
  value: Option | null;
  onChange: (opt: Option | null) => void;
  placeholder?: string;
  endpoint: '/customers/list' | '/products/list';
  emptyText?: string;
  allowClear?: boolean;
  clearLabel?: string;
}) {
  const { open, setOpen, query, setQuery, options, loading } = useRemoteSearch(endpoint);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" className="min-w-0 w-full justify-between">
          <span className="truncate">{value ? value.name : placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width] max-h-[50vh] overflow-auto">
        <Command>
          <CommandInput value={query} onValueChange={setQuery} placeholder="Digita per cercare…" />
          <CommandList>
            {allowClear && (
              <CommandItem
                value="__all__"
                onSelect={() => {
                  onChange(null);
                  setOpen(false);
                  setQuery('');
                }}
              >
                <Check className={cn('mr-2 h-4 w-4', !value ? 'opacity-100' : 'opacity-0')} />
                {clearLabel}
              </CommandItem>
            )}
            {loading ? (
              <div className="p-3 text-sm text-muted-foreground">Caricamento…</div>
            ) : options.length ? (
              options.map((opt) => (
                <CommandItem
                  key={opt.id}
                  value={opt.name}
                  onSelect={() => {
                    onChange(opt);
                    setOpen(false);
                    setQuery('');
                  }}
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