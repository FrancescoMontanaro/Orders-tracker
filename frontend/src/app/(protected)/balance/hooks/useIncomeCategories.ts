'use client';

import * as React from 'react';
import { api } from '@/lib/api-client';
import type { SortingState } from '@tanstack/react-table';

type IncomeCategory = { id: number; descr: string };
type PaginationResponse<T> = { total: number; items: T[] };
type SortField = 'id' | 'descr';

function mapSorting(sorting: SortingState): { field: SortField; order: 'asc' | 'desc' }[] | undefined {
  if (!sorting?.length) return undefined;
  return sorting.map((s) => ({
    field: s.id as SortField,
    order: s.desc ? 'desc' : 'asc',
  }));
}

export function useIncomeCategories() {
  const [page, setPage] = React.useState(1);
  const [size, setSize] = React.useState(10);
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'descr', desc: false }]);
  const [descrQuery, setDescrQuery] = React.useState('');

  const [rows, setRows] = React.useState<IncomeCategory[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filters: Record<string, any> = {};
      if (descrQuery) filters.descr = descrQuery;

      const payload = { filters, sort: mapSorting(sorting) };

      const res = await api.post<{ status: string; data: PaginationResponse<IncomeCategory> }>(
        '/incomes/categories/list',
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
    rows,
    total,
    page,
    size,
    sorting,
    setPage,
    setSize,
    setSorting,
    descrQuery,
    setDescrQuery,
    loading,
    error,
    refetch,
  };
}
