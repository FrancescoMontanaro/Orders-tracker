'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandItem, CommandEmpty } from '@/components/ui/command';
import { ChevronsUpDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRemoteSearch, type Option } from '../hooks/useRemoteSearch';

/**
 * Multi-select combobox for products (responsive)
 * - Trigger uses min-w-0 and full width to avoid x-overflow.
 * - Popover width matches trigger and becomes scrollable on small screens.
 */
export function MultiProductCombobox({
  values,
  onChange,
  placeholder = 'Tutti i prodotti…',
  emptyText = 'Nessun prodotto',
  clearLabel = 'Tutti i prodotti',
}: {
  values: Option[];
  onChange: (opts: Option[]) => void;
  placeholder?: string;
  emptyText?: string;
  clearLabel?: string;
}) {
  const { open, setOpen, query, setQuery, options, loading } = useRemoteSearch('/products/list');

  const isSelected = (id: number) => values.some((v) => v.id === id);
  const toggle = (opt: Option) => {
    if (isSelected(opt.id)) onChange(values.filter((v) => v.id !== opt.id));
    else onChange([...values, opt]);
  };

  const label =
    values.length === 0 ? placeholder : values.length === 1 ? values[0].name : `${values.length} prodotti selezionati`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" className="min-w-0 w-full justify-between">
          <span className="truncate">{label}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width] max-h-[50vh] overflow-auto">
        <Command>
          <CommandInput value={query} onValueChange={setQuery} placeholder="Digita per cercare…" />
          <CommandList>
            <CommandItem
              value="__all__"
              onSelect={() => {
                onChange([]);
                setQuery('');
              }}
            >
              <Check className={cn('mr-2 h-4 w-4', values.length === 0 ? 'opacity-100' : 'opacity-0')} />
              {clearLabel}
            </CommandItem>
            {loading ? (
              <div className="p-3 text-sm text-muted-foreground">Caricamento…</div>
            ) : options.length ? (
              options.map((opt) => {
                const selected = isSelected(opt.id);
                return (
                  <CommandItem key={opt.id} value={opt.name} onSelect={() => toggle(opt)}>
                    <Check className={cn('mr-2 h-4 w-4', selected ? 'opacity-100' : 'opacity-0')} />
                    {opt.name}
                  </CommandItem>
                );
              })
            ) : (
              <CommandEmpty>{emptyText}</CommandEmpty>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}