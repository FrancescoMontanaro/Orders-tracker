'use client';

import * as React from 'react';
import { api } from '@/lib/api-client';

export type SimpleOption = { id: number; name: string };

type Endpoint =
  | '/customers/list'
  | '/products/list'
  | 'expenses/categories/list'
  | 'incomes/categories/list';

/**
 * Lightweight remote search hook for comboboxes inside the export dialog.
 * Fetches options from the given endpoint when the popover is open.
 * Does not perform any URL manipulation (unlike the reports-page version).
 */
export function useSimpleSearch(endpoint: Endpoint, enabled = true) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [options, setOptions] = React.useState<SimpleOption[]>([]);
  const [loading, setLoading] = React.useState(false);

  // Debounce the query string to avoid sending a request on every keystroke
  const [debounced, setDebounced] = React.useState('');
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 250);
    return () => clearTimeout(t);
  }, [query]);

  const fetchOptions = React.useCallback(async () => {
    if (!open || !enabled) return;
    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        filters: { is_active: true },
        sort: [{ field: 'name', order: 'asc' }],
      };
      if (debounced.trim()) {
        (body.filters as Record<string, unknown>).name = debounced.trim();
      }

      const res = await api.post<{
        status: string;
        data: { items: Record<string, unknown>[] };
      }>(endpoint + '?page=1&size=-1', body, {
        headers: { 'Content-Type': 'application/json' },
      });

      const payload = (res.data as any).data ?? res.data;
      const list: Record<string, unknown>[] = Array.isArray(payload.items) ? payload.items : [];

      setOptions(
        list.map((x) => ({
          id: Number(x.id),
          // Categories return { id, descr }, everything else returns { id, name }
          name: String((x.descr as string | undefined) ?? (x.name as string | undefined) ?? ''),
        }))
      );
    } catch {
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }, [endpoint, debounced, open, enabled]);

  React.useEffect(() => {
    fetchOptions();
  }, [fetchOptions]);

  return { open, setOpen, query, setQuery, options, loading };
}
