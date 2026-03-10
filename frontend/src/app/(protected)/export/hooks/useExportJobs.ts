'use client';

import * as React from 'react';
import { api } from '@/lib/api-client';
import type { ExportJob } from '../types/export';
import { ACTIVE_STATUSES } from '../types/export';

export function useExportJobs() {
  const [page, setPage] = React.useState(1);
  const [size, setSize] = React.useState(10);
  const [rows, setRows] = React.useState<ExportJob[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post<{
        status: string;
        data: { total: number; items: ExportJob[] };
      }>(
        '/export/list',
        { filters: {}, sort: [{ field: 'created_at', order: 'desc' }] },
        { params: { page, size } }
      );
      const data = res.data.data;
      setRows(data.items ?? []);
      setTotal(data.total ?? 0);
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
  }, [page, size]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Poll every 5 s while there are pending/running jobs
  const hasActive = rows.some((r) => ACTIVE_STATUSES.includes(r.status));
  React.useEffect(() => {
    if (!hasActive) return;
    const id = setInterval(() => {
      fetchData();
    }, 5000);
    return () => clearInterval(id);
  }, [hasActive, fetchData]);

  return {
    rows,
    total,
    page,
    size,
    loading,
    error,
    setPage,
    setSize,
    refetch: fetchData,
  };
}
