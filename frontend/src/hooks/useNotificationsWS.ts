'use client';

import * as React from 'react';
import { getAccessToken } from '@/lib/token';
import type { Notification } from '@/types/notification';

type Handler = (notification: Notification) => void;

// Exponential backoff delays in ms
const BACKOFF_MS = [2000, 4000, 8000, 16000, 30000];

export function useNotificationsWS(onNotification: Handler): void {
  const handlerRef = React.useRef<Handler>(onNotification);

  // Always keep the ref up-to-date without triggering reconnect
  React.useLayoutEffect(() => {
    handlerRef.current = onNotification;
  });

  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    let ws: WebSocket | null = null;
    let attempt = 0;
    let dead = false;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      if (dead) return;

      const token = getAccessToken();
      if (!token) return; // not authenticated yet, skip

      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const url = `${proto}://${window.location.host}/api/notifications/ws?token=${encodeURIComponent(token)}`;

      try {
        ws = new WebSocket(url);
      } catch {
        return;
      }

      ws.onmessage = (event: MessageEvent) => {
        try {
          const notification = JSON.parse(event.data as string) as Notification;
          handlerRef.current(notification);
        } catch {
          // ignore malformed messages
        }
      };

      ws.onopen = () => {
        attempt = 0; // reset backoff on successful connection
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
      ws?.close();
    };
  }, []); // run once on mount
}
