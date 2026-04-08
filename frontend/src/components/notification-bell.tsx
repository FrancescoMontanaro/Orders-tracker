'use client';

import * as React from 'react';
import { BellIcon, CheckCheckIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { useNotifications } from '@/contexts/notifications-context';
import type { Notification } from '@/types/notification';
import { cn } from '@/lib/utils';

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const { notifications, unreadCount, loading, fetchNotifications, markAsRead, markAllAsRead } =
    useNotifications();

  // Refresh the list whenever the popover opens
  React.useEffect(() => {
    if (open) fetchNotifications();
  }, [open, fetchNotifications]);

  function handleItemClick(n: Notification) {
    if (!n.is_read) markAsRead(n.id);
    if (n.type === 'export_completed' || n.type === 'export_failed') {
      setOpen(false);
      router.push('/export');
    }
  }

  function fmtDate(s: string) {
    try {
      return new Date(s).toLocaleString('it-IT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return s;
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="Notifiche"
        >
          <BellIcon className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] leading-none pointer-events-none"
              aria-label={`${unreadCount} notifiche non lette`}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" sideOffset={8} className="w-80 p-0">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2.5">
          <span className="text-sm font-semibold">Notifiche</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs text-muted-foreground"
              onClick={markAllAsRead}
            >
              <CheckCheckIcon className="h-3.5 w-3.5" />
              Segna tutte lette
            </Button>
          )}
        </div>

        <Separator />

        {/* List */}
        <div className="max-h-[360px] overflow-y-auto">
          {loading && notifications.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              Caricamento…
            </p>
          ) : notifications.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              Nessuna notifica
            </p>
          ) : (
            notifications.map((n, i) => (
              <React.Fragment key={n.id}>
                {i > 0 && <Separator />}
                <button
                  type="button"
                  onClick={() => handleItemClick(n)}
                  className={cn(
                    'w-full text-left px-3 py-2.5 transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none',
                    !n.is_read && 'bg-primary/5'
                  )}
                >
                  <div className="flex items-start gap-2 min-w-0">
                    {!n.is_read && (
                      <span
                        className="mt-[5px] h-2 w-2 shrink-0 rounded-full bg-primary"
                        aria-hidden
                      />
                    )}
                    <div className={cn('min-w-0 flex-1', n.is_read && 'pl-4')}>
                      <p className="truncate text-sm font-medium leading-snug">
                        {n.title}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground leading-snug">
                        {n.message}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground/70">
                        {fmtDate(n.created_at)}
                      </p>
                    </div>
                  </div>
                </button>
              </React.Fragment>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
