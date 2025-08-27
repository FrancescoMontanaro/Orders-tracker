import * as React from 'react';
import { api } from '@/lib/api-client';
import type { SortingState } from '@tanstack/react-table';
import type { Pagination, SuccessResponse } from '@/types/api';
import type { Expense, SortParam } from '../types/expense';
import { allowedSortFields } from '../types/expense';
import { useDebouncedValue } from './useDebouncedValue';

/**
 * Centralizes data fetching (POST /expenses/list) and the UI state for:
 * paging, sorting, filters, loading/error status.
 * NOTE: No behavioral changes; this is a straight extraction from the page.
 */
export function useExpenses() {
  const [rows, setRows] = React.useState<Expense[]>([]);
  const [total, setTotal] = React.useState(0);

  const [page, setPage] = React.useState(1);
  const [size, setSize] = React.useState(10);

  const [sorting, setSorting] = React.useState<SortingState>([
    { id: 'timestamp', desc: true },
  ]);

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // UI filters (identical to original behavior)
  const [noteQuery, setNoteQuery] = React.useState<string>('');
  const [amountMin, setAmountMin] = React.useState<string>('');
  const [amountMax, setAmountMax] = React.useState<string>('');
  const [dateFrom, setDateFrom] = React.useState<string>(''); // YYYY-MM-DD
  const [dateTo, setDateTo] = React.useState<string>('');     // YYYY-MM-DD

  const debouncedNote = useDebouncedValue(noteQuery, 350);
  const debouncedMin = useDebouncedValue(amountMin, 350);
  const debouncedMax = useDebouncedValue(amountMax, 350);
  const debouncedFrom = useDebouncedValue(dateFrom, 350);
  const debouncedTo = useDebouncedValue(dateTo, 350);

  const fetchPage = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Body: logical filters (e.g., note) + sort
      const filters: Record<string, any> = {};
      if (debouncedNote.trim()) filters.note = debouncedNote.trim();

      const sort: SortParam[] = (sorting || [])
        .map((s) => {
          const id = s.id as SortParam['field'];
          if (!allowedSortFields.has(id)) return null;
          return { field: id, order: s.desc ? 'desc' : 'asc' };
        })
        .filter(Boolean) as SortParam[];

      // Query string: page/size + date/amount ranges
      const params: Record<string, any> = { page, size };
      if (debouncedFrom) params.timestamp_after = debouncedFrom;
      if (debouncedTo) params.timestamp_before = debouncedTo;

      if (debouncedMin !== '' && !Number.isNaN(Number(debouncedMin))) {
        params.min_amount = Number(debouncedMin);
      }
      if (debouncedMax !== '' && !Number.isNaN(Number(debouncedMax))) {
        params.max_amount = Number(debouncedMax);
      }

      const res = await api.post<SuccessResponse<Pagination<Expense>>>(
        '/expenses/list',
        { filters, sort },
        { params, headers: { 'Content-Type': 'application/json' } }
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
      setError(`Impossibile caricare le spese: ${String(detail)}`);
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, size, sorting, debouncedNote, debouncedMin, debouncedMax, debouncedFrom, debouncedTo]);

  React.useEffect(() => { fetchPage(); }, [fetchPage]);

  // Reset to page 1 whenever filters change, as originally implemented.
  React.useEffect(() => {
    setPage(1);
  }, [debouncedNote, debouncedMin, debouncedMax, debouncedFrom, debouncedTo]);

  return {
    rows, total, page, size, sorting, loading, error,
    noteQuery, amountMin, amountMax, dateFrom, dateTo,
    setPage, setSize, setSorting, setNoteQuery, setAmountMin, setAmountMax, setDateFrom, setDateTo,
    refetch: fetchPage,
  };
}