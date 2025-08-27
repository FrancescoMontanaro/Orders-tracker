import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandItem, CommandEmpty } from '@/components/ui/command';
import { ChevronsUpDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRemoteSearch } from '../hooks/useRemoteSearch';
import { Option } from '../types/option';

/**
 * Generic command+popover combobox backed by remote search.
 * Matches the original interaction and keyboard behavior.
 */
export function SearchCombobox({
  value,
  onChange,
  placeholder = 'Cerca…',
  endpoint,
  emptyText = 'Nessun risultato',
}: {
  value: Option | null;
  onChange: (opt: Option | null) => void;
  placeholder?: string;
  endpoint: '/customers/list' | '/products/list';
  emptyText?: string;
}) {
  const { open, setOpen, query, setQuery, options, loading } = useRemoteSearch(endpoint);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          className="w-full justify-between"
        >
          {value ? value.name : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width]">
        <Command>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Digita per cercare…"
          />
          <CommandList>
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