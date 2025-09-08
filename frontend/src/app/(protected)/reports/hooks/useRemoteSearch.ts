'use client';

import * as React from 'react';
import { api } from '@/lib/api-client';
import { useDebouncedValue } from './useDebouncedValue';

type SuccessResponse<T> = { status: 'success'; data: T };
type Pagination<T> = { total: number; items: T[] };

export type Option = {
  id: number;
  name: string;
  unit_price?: number | null;
  unit?: string | null;
};

type Endpoint = '/customers/list' | '/products/list' | 'expenses/categories/list';

/**
 * Remote search with debounce tailored to the shadcn combobox UX:
 * - Opens/closes the popover
 * - Fetches active options, ordered by name
 * - Supports client-side filtering when typing
 */
export function useRemoteSearch(endpoint: Endpoint) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const debounced = useDebouncedValue(query, 250);
  const [options, setOptions] = React.useState<Option[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const fetchOptions = React.useCallback(async () => {
    if (!open) return;
    setLoading(true);
    setError(null);
    try {
      const body: any = {
        filters: { is_active: true },
        sort: [{ field: 'name', order: 'asc' }]
      };
      if (debounced.trim()) body.filters.name = debounced.trim();

      const res = await api.post<
        SuccessResponse<Pagination<{ id: number; name: string; unit_price?: number; unit?: string }>>
      >(endpoint + '?page=1&size=-1', body, { headers: { 'Content-Type': 'application/json' } });

      const payload = (res.data as any).data ?? (res.data as any);
      const list = Array.isArray(payload.items) ? payload.items : [];

      setOptions(
        list.map((x: any) =>
          endpoint === '/products/list'
            ? { id: Number(x.id), name: String(x.name), unit_price: x.unit_price ?? null, unit: x.unit ?? null }
            : endpoint === 'expenses/categories/list'
            ? { id: Number(x.id), name: String(x.descr ?? x.name ?? '') }
            : { id: Number(x.id), name: String(x.name) }
        )
      );
    } catch (e: any) {
      const detail = e?.response?.data?.detail ?? e?.response?.data?.message ?? e?.message ?? 'Errore sconosciuto';
      setError(String(detail));
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }, [endpoint, debounced, open]);

  React.useEffect(() => { fetchOptions(); }, [fetchOptions]);
  React.useEffect(() => {
    // When opening with empty query, fetch initial page of options
    if (open && !debounced) fetchOptions();
  }, [open]); // eslint-disable-line

  return { open, setOpen, query, setQuery, options, loading, error };
}