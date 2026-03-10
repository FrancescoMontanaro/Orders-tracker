'use client';

import * as React from 'react';
import { api } from '@/lib/api-client';
import { getAccessToken } from '@/lib/token';
import type { ExportJob } from '../types/export';

const BACKOFF_MS = [2000, 4000, 8000, 16000, 30000];

function buildExportWsUrl(token: string): string {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';
  const path = `/export/ws?token=${encodeURIComponent(token)}`;
  if (apiBase.startsWith('http://') || apiBase.startsWith('https://')) {
    return apiBase.replace(/^http/, 'ws') + path;
  }
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${window.location.host}${apiBase}${path}`;
}

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

  // WebSocket — receive real-time job updates and patch rows in place
  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    let ws: WebSocket | null = null;
    let attempt = 0;
    let dead = false;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      if (dead) return;

      const token = getAccessToken();
      if (!token) {
        reconnectTimeout = setTimeout(connect, 1000);
        return;
      }

      try {
        ws = new WebSocket(buildExportWsUrl(token));
      } catch {
        const delay = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)];
        attempt++;
        reconnectTimeout = setTimeout(connect, delay);
        return;
      }

      ws.onopen = () => {
        attempt = 0;
      };

      ws.onmessage = (event: MessageEvent) => {
        try {
          const updated = JSON.parse(event.data as string) as ExportJob;
          setRows((prev) => {
            const idx = prev.findIndex((r) => r.id === updated.id);
            if (idx === -1) return prev; // job not on current page — ignore
            const next = [...prev];
            next[idx] = { ...prev[idx], ...updated };
            return next;
          });
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = (event: CloseEvent) => {
        if (dead) return;
        if (event.code === 4001) return; // auth failure, do not retry
        const delay = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)];
        attempt++;
        reconnectTimeout = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        ws?.close();
      };
    }

    connect();

    return () => {
      dead = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws) {
        ws.onopen = null;
        ws.onmessage = null;
        ws.onclose = null;
        ws.onerror = null;
        ws.close();
      }
    };
  }, []); // WS lifecycle is independent of pagination — refetch handles page changes

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
