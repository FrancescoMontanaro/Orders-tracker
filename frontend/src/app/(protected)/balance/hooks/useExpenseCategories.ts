'use client';

import * as React from 'react';
import { api } from '@/lib/api-client';
import type { SortingState } from '@tanstack/react-table';

type ExpenseCategory = { id: number; descr: string };
type PaginationResponse<T> = { total: number; items: T[] };

type SortField = 'id' | 'descr';

// Map TanStack sorting → backend sort payload
function mapSorting(sorting: SortingState): { field: SortField; order: 'asc' | 'desc' }[] | undefined {
  if (!sorting?.length) return undefined;
  return sorting.map(s => ({
    field: (s.id as SortField),
    order: s.desc ? 'desc' : 'asc',
  }));
}

/** Data hook for expense categories listing (filters, sorting, pagination). */
export function useExpenseCategories() {
  // Pagination / sorting
  const [page, setPage] = React.useState(1);
  const [size, setSize] = React.useState(10);
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'descr', desc: false }]);

  // Filters
  const [descrQuery, setDescrQuery] = React.useState('');

  // Data state
  const [rows, setRows] = React.useState<ExpenseCategory[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Build filters for backend
      const filters: Record<string, any> = {};
      if (descrQuery) filters.descr = descrQuery;

      const payload = { filters, sort: mapSorting(sorting) };

      // POST /expenses/categories/list with page/size as query params
      const res = await api.post<{ status: string; data: PaginationResponse<ExpenseCategory> }>(
        '/expenses/categories/list',
        payload,
        { params: { page, size } }
      );

      const data = res?.data?.data;
      setRows(data?.items ?? []);
      setTotal(data?.total ?? 0);
    } catch (e: any) {
      const msg =
        e?.response?.data?.detail ??
        e?.response?.data?.message ??
        e?.message ??
        'Errore di caricamento';
      setError(String(msg));
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, size, sorting, descrQuery]);

  React.useEffect(() => { fetchData(); }, [fetchData]);

  const refetch = React.useCallback(fetchData, [fetchData]);

  return {
    // data
    rows, total,
    // pagination/sorting
    page, size, sorting,
    setPage, setSize, setSorting,
    // filters
    descrQuery, setDescrQuery,
    // status
    loading, error,
    // actions
    refetch,
  };
}