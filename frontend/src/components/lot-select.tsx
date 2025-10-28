'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import {
  Command,
  CommandInput,
  CommandList,
  CommandItem,
  CommandEmpty,
} from '@/components/ui/command';
import { ChevronsUpDown, Check, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLotsSearch } from '@/hooks/useLotsSearch';
import { LotOption, formatLotOptionDate } from '@/types/lot';

type LotSelectProps = {
  value: LotOption | null;
  onChange: (lot: LotOption | null) => void;
  placeholder?: string;
  className?: string;
  allowClear?: boolean;
  disabled?: boolean;
};

export function LotSelect({
  value,
  onChange,
  placeholder = 'Seleziona lotto…',
  className,
  allowClear = true,
  disabled = false,
}: LotSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const { options, loading, refetch } = useLotsSearch(open, query);

  const triggerLabel = value
    ? `${value.name}${value.lot_date ? ` • ${formatLotOptionDate(value.lot_date)}` : ''}`
    : placeholder;

  return (
    <Popover open={open} onOpenChange={(next) => {
      setOpen(next);
      if (next) {
        setQuery('');
        setTimeout(refetch, 0);
      }
    }}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          disabled={disabled}
          className={cn('w-full justify-between', className)}
        >
          <span className="truncate">{triggerLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width] min-w-[16rem]">
        <Command>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Cerca per nome o data…"
          />
          <CommandList>
            {allowClear && (
              <CommandItem
                key="__none"
                value="__none"
                onSelect={() => {
                  onChange(null);
                  setOpen(false);
                  setQuery('');
                }}
              >
                <Check className={cn('mr-2 h-4 w-4', !value ? 'opacity-100' : 'opacity-0')} />
                Nessun lotto
              </CommandItem>
            )}

            {loading ? (
              <div className="p-3 text-sm text-muted-foreground">Caricamento…</div>
            ) : options.length ? (
              options.map((lot) => (
                <CommandItem
                  key={lot.id}
                  value={`${lot.name} ${lot.lot_date}`}
                  onSelect={() => {
                    onChange(lot);
                    setOpen(false);
                    setQuery('');
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value?.id === lot.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <div className="flex flex-col">
                    <span className="font-medium leading-tight">{lot.name}</span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" aria-hidden />
                      {formatLotOptionDate(lot.lot_date) || 'Data non disponibile'}
                    </span>
                    {lot.description ? (
                      <span className="text-xs text-muted-foreground line-clamp-1">
                        {lot.description}
                      </span>
                    ) : null}
                  </div>
                </CommandItem>
              ))
            ) : (
              <CommandEmpty>Nessun lotto trovato</CommandEmpty>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
