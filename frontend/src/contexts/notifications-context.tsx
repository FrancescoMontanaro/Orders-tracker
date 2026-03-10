'use client';

import * as React from 'react';
import { api } from '@/lib/api-client';
import { getAccessToken } from '@/lib/token';
import type { Notification } from '@/types/notification';
import type { SuccessResponse, Pagination } from '@/types/api';

type NotificationsContextType = {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
};

const NotificationsContext = React.createContext<NotificationsContextType | null>(null);

const BACKOFF_MS = [2000, 4000, 8000, 16000, 30000];

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const [loading, setLoading] = React.useState(false);

  // Derived — single source of truth, no separate counter state
  const unreadCount = React.useMemo(
    () => notifications.filter((n) => !n.is_read).length,
    [notifications]
  );

  const fetchNotifications = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.post<SuccessResponse<Pagination<Notification>>>(
        '/notifications/list',
        { filters: {}, sort: [{ field: 'created_at', order: 'desc' }] },
        { params: { page: 1, size: 20 } }
      );
      setNotifications(res.data.data.items ?? []);
    } catch {
      // silent — notifications must not break the UI
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // WebSocket — lives here at context level so setNotifications is always the
  // correct, stable setter from this provider instance. No ref indirection needed.
  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    let ws: WebSocket | null = null;
    let attempt = 0;
    let dead = false;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

    // Build the WebSocket URL from NEXT_PUBLIC_API_BASE_URL so it works both
    // in development (absolute URL like http://host:8000/api) and in production
    // (relative path like /api served behind nginx).
    function buildWsUrl(token: string): string {
      const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';
      const path = `/notifications/ws?token=${encodeURIComponent(token)}`;
      if (apiBase.startsWith('http://') || apiBase.startsWith('https://')) {
        // Absolute URL: replace http(s) scheme with ws(s)
        return apiBase.replace(/^http/, 'ws') + path;
      }
      // Relative path: derive host from the current page origin
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
      return `${proto}://${window.location.host}${apiBase}${path}`;
    }

    function connect() {
      if (dead) return;

      const token = getAccessToken();
      if (!token) {
        // Auth not ready yet — retry in 1 s without counting as a backoff attempt
        reconnectTimeout = setTimeout(connect, 1000);
        return;
      }

      try {
        ws = new WebSocket(buildWsUrl(token));
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
          const notification = JSON.parse(event.data as string) as Notification;
          setNotifications((prev) => [notification, ...prev.slice(0, 19)]);
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
        // Null handlers before closing: prevents the reconnect path from firing
        // and suppresses the "closed before established" console noise in
        // React StrictMode (where the effect is mounted/unmounted twice in dev).
        ws.onopen = null;
        ws.onmessage = null;
        ws.onclose = null;
        ws.onerror = null;
        ws.close();
      }
    };
  }, []); // setNotifications is a stable React setter — safe to omit from deps

  const markAsRead = React.useCallback(async (id: number) => {
    try {
      await api.post(`/notifications/read/${id}`);
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n
        )
      );
    } catch {
      // silent
    }
  }, []);

  const markAllAsRead = React.useCallback(async () => {
    try {
      await api.post('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch {
      // silent
    }
  }, []);

  const value = React.useMemo(
    () => ({ notifications, unreadCount, loading, fetchNotifications, markAsRead, markAllAsRead }),
    [notifications, unreadCount, loading, fetchNotifications, markAsRead, markAllAsRead]
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications(): NotificationsContextType {
  const ctx = React.useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within <NotificationsProvider>');
  return ctx;
}
