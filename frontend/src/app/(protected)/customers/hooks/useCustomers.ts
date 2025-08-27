import * as React from 'react';
import { api } from '@/lib/api-client';
import type { SortingState } from '@tanstack/react-table';
import type { Pagination, SuccessResponse } from '@/types/api';
import type { Customer, SortParam } from '../types/customer';
import { allowedSortFields } from '../types/customer';
import { useDebouncedValue } from './useDebouncedValue';

/**
 * Centralizes data fetching (POST /customers/list) and the UI state for:
 * paging, sorting, filters, loading/error status.
 * NOTE: No behavioral changes; this is a straight extraction from the page.
 */
export function useCustomers() {
  const [rows, setRows] = React.useState<Customer[]>([]);
  const [total, setTotal] = React.useState(0);

  const [page, setPage] = React.useState(1);
  const [size, setSize] = React.useState(10);

  const [sorting, setSorting] = React.useState<SortingState>([
    { id: 'name', desc: false },
  ]);

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // UI filters (identical to original behavior)
  const [searchName, setSearchName] = React.useState<string>('');
  const [statusFilter, setStatusFilter] = React.useState<'all' | 'active' | 'inactive'>('active');

  const debouncedName = useDebouncedValue(searchName, 350);

  const fetchPage = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filters: Record<string, any> = {};
      if (debouncedName.trim()) filters.name = debouncedName.trim();

      if (statusFilter === 'active') filters.is_active = true;
      else if (statusFilter === 'inactive') filters.is_active = false;

      const sort: SortParam[] = sorting
        .map((s) => {
          const id = s.id as SortParam['field'];
          if (!allowedSortFields.has(id)) return null;
          return { field: id, order: s.desc ? 'desc' : 'asc' };
        })
        .filter(Boolean) as SortParam[];

      const res = await api.post<SuccessResponse<Pagination<Customer>>>(
        '/customers/list',
        { filters, sort },
        {
          params: { page, size },
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
      setError(`Impossibile caricare i clienti: ${String(detail)}`);
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, size, sorting, debouncedName, statusFilter]);

  React.useEffect(() => { fetchPage(); }, [fetchPage]);

  // Reset pagination when filters change (same as original).
  React.useEffect(() => { setPage(1); }, [debouncedName, statusFilter]);

  return {
    rows, total, page, size, sorting, loading, error,
    searchName, statusFilter,
    setPage, setSize, setSorting, setSearchName, setStatusFilter,
    refetch: fetchPage,
  };
}