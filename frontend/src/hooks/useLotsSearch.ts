import * as React from 'react';
import { api } from '@/lib/api-client';
import type { SuccessResponse, Pagination } from '@/types/api';
import type { LotOption } from '@/types/lot';

function useDebounced(value: string, delay = 300) {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(handle);
  }, [value, delay]);
  return debounced;
}

function normaliseLotDate(query: string): string | null {
  const trimmed = query.trim();
  if (!trimmed) return null;
  const cleaned = trimmed.replace(/\./g, '-').replace(/\s+/g, '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
    const [d, m, y] = trimmed.split('/');
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  if (/^\d{2}-\d{2}-\d{4}$/.test(cleaned)) {
    const [d, m, y] = cleaned.split('-');
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return null;
}

type LotsResponse = SuccessResponse<Pagination<{ id: number; name: string; lot_date: string; description?: string | null }>>;

export function useLotsSearch(open: boolean, query: string) {
  const debounced = useDebounced(query, 250);
  const [options, setOptions] = React.useState<LotOption[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const fetchLots = React.useCallback(async () => {
    if (!open) return;
    setLoading(true);
    setError(null);
    try {
      const filters: Record<string, any> = {};
      if (debounced.trim()) {
        filters.name = debounced.trim();
        const date = normaliseLotDate(debounced);
        if (date) {
          filters.lot_date_after = date;
          filters.lot_date_before = date;
        }
      }
      const res = await api.post<LotsResponse>(
        '/lots/list',
        {
          filters,
          sort: [
            { field: 'lot_date', order: 'desc' },
            { field: 'id', order: 'desc' },
          ],
        },
        {
          params: { page: 1, size: 50 },
          headers: { 'Content-Type': 'application/json' },
        }
      );
      const payload = res.data.data;
      const items = Array.isArray(payload?.items) ? payload.items : [];
      setOptions(
        items.map((lot) => ({
          id: Number(lot.id),
          name: String(lot.name),
          lot_date: lot.lot_date ?? '',
          description: lot.description ?? null,
        }))
      );
    } catch (e: any) {
      const detail =
        e?.response?.data?.detail ??
        e?.response?.data?.message ??
        e?.message ??
        'Errore sconosciuto';
      setError(String(detail));
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }, [open, debounced]);

  React.useEffect(() => {
    fetchLots();
  }, [fetchLots]);

  return { options, loading, error, refetch: fetchLots };
}
