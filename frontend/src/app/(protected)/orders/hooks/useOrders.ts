import * as React from 'react';
import { api } from '@/lib/api-client';
import { SortingState } from '@tanstack/react-table';
import { Order } from '../types/order';
import { Pagination, SuccessResponse } from '@/types/api';
import { useDebouncedValue } from './useDebouncedValue';

// Keep original allowed sort fields as-is for full compatibility
const allowedSortFields = new Set(['delivery_date', 'customer_name', 'total_price', 'status'] as const);
type SortParam = { field: 'delivery_date' | 'customer_name' | 'total_price' | 'status'; order: 'asc' | 'desc' };

/**
 * Data loader for /orders/list with the same filter/sort/pagination semantics.
 * Nothing functional changes; we only lift the logic out of the page component.
 */
export function useOrders() {
  const [rows, setRows] = React.useState<Order[]>([]);
  const [total, setTotal] = React.useState(0);

  const [page, setPage] = React.useState(1);
  const [size, setSize] = React.useState(10);

  // default: status asc (created first), then delivery_date asc
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: 'status', desc: false },
    { id: 'delivery_date', desc: false },
  ]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // UI filters
  const [searchName, setSearchName] = React.useState<string>(''); // filters.customer_name
  const [status, setStatus] = React.useState<'all' | 'created' | 'delivered'>('all');
  const [dateFrom, setDateFrom] = React.useState<string>(''); // YYYY-MM-DD
  const [dateTo, setDateTo] = React.useState<string>('');     // YYYY-MM-DD

  const debouncedSearch = useDebouncedValue(searchName, 350);
  const debouncedFrom = useDebouncedValue(dateFrom, 350);
  const debouncedTo = useDebouncedValue(dateTo, 350);
  const debouncedStatus = useDebouncedValue(status, 250);

  const fetchPage = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Body: filters + sort
      const filters: Record<string, any> = {};
      if (debouncedSearch.trim()) filters.customer_name = debouncedSearch.trim();
      if (debouncedStatus !== 'all') filters.status = debouncedStatus;

      const sort: SortParam[] = (sorting || [])
        .map((s) => {
          const id = s.id as SortParam['field'];
          if (!allowedSortFields.has(id)) return null;
          return { field: id, order: s.desc ? 'desc' : 'asc' };
        })
        .filter(Boolean) as SortParam[];

      // Query: page, size, dates
      const params: Record<string, any> = { page, size };
      if (debouncedFrom) params.delivery_date_after = debouncedFrom;
      if (debouncedTo) params.delivery_date_before = debouncedTo;

      const res = await api.post<SuccessResponse<Pagination<Order>>>(
        '/orders/list',
        { filters, sort },
        {
          params,
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const payload = res.data.data;
      setRows(Array.isArray(payload.items) ? payload.items : []);
      setTotal(Number(payload.total) || 0);
    } catch (e: any) {
      const detail =
        e?.response?.data?.detail ??
        e?.response?.data?.message ??
        e?.message ??
        'Errore sconosciuto';
      setError(`Impossibile caricare gli ordini: ${String(detail)}`);
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, size, sorting, debouncedSearch, debouncedFrom, debouncedTo, debouncedStatus]);

  React.useEffect(() => { fetchPage(); }, [fetchPage]);
  React.useEffect(() => { setPage(1); }, [debouncedSearch, debouncedFrom, debouncedTo, debouncedStatus]);

  return {
    rows, total, page, size, sorting, loading, error,
    searchName, status, dateFrom, dateTo,
    setPage, setSize, setSorting, setSearchName, setStatus, setDateFrom, setDateTo,
    refetch: fetchPage,
  };
}