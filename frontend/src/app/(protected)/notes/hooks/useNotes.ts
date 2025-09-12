'use client';

import * as React from 'react';
import { api } from '@/lib/api-client';
import type { Note } from '../types/note';

export type SortDirection = 'asc' | 'desc';
export type SortParam = { id: 'created_at' | 'updated_at' | 'text'; desc?: boolean };

type Pagination<T> = { total: number; items: T[] };

export function useNotes() {
  const [rows, setRows] = React.useState<Note[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [size, setSize] = React.useState(-1);
  const [sorting, setSorting] = React.useState<SortParam[]>([{ id: 'updated_at', desc: true }]);

  const [searchText, setSearchText] = React.useState('');
  const [createdAfter, setCreatedAfter] = React.useState<string | null>(null);
  const [createdBefore, setCreatedBefore] = React.useState<string | null>(null);

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const fetchList = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filters: Record<string, any> = {};
      if (searchText.trim()) filters['text'] = searchText.trim();
      if (createdAfter) filters['created_after'] = createdAfter;
      if (createdBefore) filters['created_before'] = createdBefore;

      const sort = sorting.length
        ? sorting.map((s) => ({ field: s.id, order: s.desc ? 'desc' : 'asc' }))
        : undefined;

      const res = await api.post('/notes/list', {
        page,
        size,
        filters,
        sort,
      });
      const data = res.data?.data as Pagination<Note>;
      setRows(data.items || []);
      setTotal(data.total || 0);
    } catch (e: any) {
      const detail =
        e?.response?.data?.detail ??
        e?.response?.data?.message ??
        e?.message ??
        'Errore sconosciuto';
      setError(String(detail));
    } finally {
      setLoading(false);
    }
  }, [page, size, sorting, searchText, createdAfter, createdBefore]);

  React.useEffect(() => {
    fetchList();
  }, [fetchList]);

  const refetch = React.useCallback(() => {
    fetchList();
  }, [fetchList]);

  return {
    rows, total, page, size, sorting,
    searchText, setSearchText,
    createdAfter, setCreatedAfter,
    createdBefore, setCreatedBefore,
    setPage, setSize, setSorting,
    loading, error, refetch,
  };
}