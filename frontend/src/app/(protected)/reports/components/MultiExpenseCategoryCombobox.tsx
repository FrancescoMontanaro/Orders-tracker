'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandItem, CommandEmpty } from '@/components/ui/command';
import { ChevronsUpDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRemoteSearch, type Option } from '../hooks/useRemoteSearch';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/**
 * Multi-select combobox for expense categories (responsive)
 * - Same structure and UX as MultiProductCombobox.
 * - Works with API payloads that return { id, descr } by falling back to descr when name is missing.
 */
export function MultiExpenseCategoryCombobox({
  values,
  onChange,
  placeholder = 'Tutte le categorie…',
  emptyText = 'Nessuna categoria',
  clearLabel = 'Tutte le categorie',
}: {
  values: Option[] | Array<Option & { descr?: string }>;
  onChange: (opts: Option[]) => void;
  placeholder?: string;
  emptyText?: string;
  clearLabel?: string;
}) {
  const { open, setOpen, query, setQuery, options, loading } = useRemoteSearch('expenses/categories/list');

  // Router utilities to manipulate the URL query string
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  // Remove category_id from the URL when the selection changes
  const clearCategoryIdFromUrl = React.useCallback(() => {
    try {
      const params = new URLSearchParams(sp?.toString() || '');
      if (params.has('category_id')) {
        params.delete('category_id');
        const qs = params.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      }
    } catch {
      // no-op on URL manipulation errors
    }
  }, [router, pathname, sp]);

  // Prefer opt.name; fallback to opt.descr to support API that returns { id, descr }
  const getLabel = (opt: any) => (opt?.name ?? opt?.descr ?? '');

  const isSelected = (id: number) => values.some((v: any) => v.id === id);
  const toggle = (opt: any) => {
    const mapped: Option = { id: Number(opt.id), name: String(getLabel(opt)) };
    if (isSelected(mapped.id)) onChange((values as any[]).filter((v) => v.id !== mapped.id));
    else onChange([...(values as any[]), mapped]);
    // After any selection change, drop category_id from the query string
    clearCategoryIdFromUrl();
  };

  const currentLabel =
    values.length === 0
      ? placeholder
      : values.length === 1
      ? getLabel(values[0] as any)
      : `${values.length} categorie selezionate`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" className="min-w-0 w-full justify-between">
          <span className="truncate">{currentLabel}</span>
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
                // Also clear category_id when resetting to "all"
                clearCategoryIdFromUrl();
              }}
            >
              <Check className={cn('mr-2 h-4 w-4', values.length === 0 ? 'opacity-100' : 'opacity-0')} />
              {clearLabel}
            </CommandItem>
            {loading ? (
              <div className="p-3 text-sm text-muted-foreground">Caricamento…</div>
            ) : options.length ? (
              options.map((opt: any) => {
                const selected = isSelected(Number(opt.id));
                const label = getLabel(opt);
                return (
                  <CommandItem key={opt.id} value={label} onSelect={() => toggle(opt)}>
                    <Check className={cn('mr-2 h-4 w-4', selected ? 'opacity-100' : 'opacity-0')} />
                    {label}
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