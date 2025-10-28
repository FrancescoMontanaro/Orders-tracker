import * as React from 'react';
import type { SortingState } from '@tanstack/react-table';
import { api } from '@/lib/api-client';
import type { SuccessResponse, Pagination } from '@/types/api';
import type { Lot, SortParam } from '../types/lot';
import { allowedSortFields } from '../types/lot';
import { useDebouncedValue } from './useDebouncedValue';

/**
 * Centralizes loading state, filters and pagination for the Lots area.
 * Mirrors the approach used in other protected pages.
 */
export function useLots() {
  const [rows, setRows] = React.useState<Lot[]>([]);
  const [total, setTotal] = React.useState(0);

  const [page, setPage] = React.useState(1);
  const [size, setSize] = React.useState(10);

  const [sorting, setSorting] = React.useState<SortingState>([
    { id: 'lot_date', desc: true },
    { id: 'id', desc: true }
  ]);

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = React.useState('');
  const [dateFrom, setDateFrom] = React.useState<string | undefined>(undefined);
  const [dateTo, setDateTo] = React.useState<string | undefined>(undefined);
  const [locationTerm, setLocationTerm] = React.useState('');

  const debouncedSearch = useDebouncedValue(searchTerm, 350);
  const debouncedLocation = useDebouncedValue(locationTerm, 350);

  const fetchPage = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filters: Record<string, any> = {};
      if (debouncedSearch.trim()) filters.name = debouncedSearch.trim();
      if (debouncedLocation.trim()) filters.location = debouncedLocation.trim();
      if (dateFrom) filters.lot_date_after = dateFrom;
      if (dateTo) filters.lot_date_before = dateTo;

      const sort: SortParam[] = sorting
        .map((s) => {
          const id = s.id as SortParam['field'];
          if (!allowedSortFields.has(id)) return null;
          return { field: id, order: s.desc ? 'desc' : 'asc' };
        })
        .filter(Boolean) as SortParam[];

      const res = await api.post<SuccessResponse<Pagination<Lot>>>(
        '/lots/list',
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
      setError(`Impossibile caricare i lotti: ${String(detail)}`);
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, size, sorting, debouncedSearch, debouncedLocation, dateFrom, dateTo]);

  React.useEffect(() => {
    fetchPage();
  }, [fetchPage]);

  React.useEffect(() => {
    setPage(1);
  }, [debouncedSearch, debouncedLocation, dateFrom, dateTo]);

  return {
    rows,
    total,
    page,
    size,
    sorting,
    loading,
    error,
    searchTerm,
    dateFrom,
    dateTo,
    locationTerm,
    setPage,
    setSize,
    setSorting,
    setSearchTerm,
    setDateFrom,
    setDateTo,
    setLocationTerm,
    refetch: fetchPage,
  };
}
