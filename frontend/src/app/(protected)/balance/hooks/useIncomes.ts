'use client';

import * as React from 'react';
import { api } from '@/lib/api-client';
import type { Income, IncomeSortParam } from '../types/income';
import type { SortingState } from '@tanstack/react-table';

type PaginationResponse<T> = { total: number; items: T[]; total_amount: number; };

function mapSorting(sorting: SortingState): { field: IncomeSortParam['field']; order: 'asc' | 'desc' }[] | undefined {
  if (!sorting?.length) return undefined;
  return sorting.map((s) => ({
    field: s.id as IncomeSortParam['field'],
    order: s.desc ? 'desc' : 'asc',
  }));
}

export function useIncomes() {
  const [page, setPage] = React.useState(1);
  const [size, setSize] = React.useState(10);
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'timestamp', desc: true }]);

  const [noteQuery, setNoteQuery] = React.useState('');
  const [amountMin, setAmountMin] = React.useState('');
  const [amountMax, setAmountMax] = React.useState('');
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');
  const [categoryId, setCategoryId] = React.useState<number | ''>('');

  const [rows, setRows] = React.useState<Income[]>([]);
  const [total, setTotal] = React.useState(0);
  const [totalAmount, setTotalAmount] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filters: Record<string, any> = {};
      if (noteQuery) filters.note = noteQuery;
      if (amountMin) filters.min_amount = Number(amountMin);
      if (amountMax) filters.max_amount = Number(amountMax);
      if (dateFrom) filters.timestamp_after = dateFrom;
      if (dateTo) filters.timestamp_before = dateTo;
      if (categoryId !== '') filters.category_id = categoryId;

      const payload = {
        filters,
        sort: mapSorting(sorting),
      };

      const res = await api.post<{ status: string; data: PaginationResponse<Income> }>(
        '/incomes/list',
        payload,
        { params: { page, size } }
      );

      const data = res?.data?.data;
      setRows(data?.items ?? []);
      setTotal(data?.total ?? 0);
      setTotalAmount(data?.total_amount ?? 0);
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
  }, [page, size, sorting, noteQuery, amountMin, amountMax, dateFrom, dateTo, categoryId]);

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
    noteQuery,
    amountMin,
    amountMax,
    dateFrom,
    dateTo,
    setNoteQuery,
    setAmountMin,
    setAmountMax,
    setDateFrom,
    setDateTo,
    categoryId,
    setCategoryId,
    loading,
    error,
    refetch,
    totalAmount,
  };
}
