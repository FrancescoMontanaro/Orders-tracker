import * as React from 'react';
import { api } from '@/lib/api-client';
import { SuccessResponse, Pagination } from '@/types/api';
import { Option } from '../types/option';
import { useDebouncedValue } from './useDebouncedValue';

/**
 * Remote search for customers/products. It mirrors the original logic:
 * - POST /customers/list or /products/list
 * - filters by `name` when the query is present
 * - only active items
 * - sorted by name asc
 */
export function useRemoteSearch(endpoint: '/customers/list' | '/products/list') {
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
        sort: [{ field: 'name', order: 'asc' }],
      };
      if (debounced.trim()) {
        body.filters.name = debounced.trim();
      }
      const res = await api.post<SuccessResponse<Pagination<{ id: number; name: string; unit_price?: number; unit?: string }>>>(
        endpoint,
        body,
        { headers: { 'Content-Type': 'application/json' } }
      );
      const payload = (res.data as any).data ?? (res.data as any);
      const list = Array.isArray(payload.items) ? payload.items : [];
      setOptions(
        list.map((x: any) =>
          endpoint === '/products/list'
            ? { id: Number(x.id), name: String(x.name), unit_price: x.unit_price ?? null, unit: x.unit ?? null }
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
    if (open && !debounced) fetchOptions();
  }, [open]); // eslint-disable-line

  return { open, setOpen, query, setQuery, options, loading, error };
}