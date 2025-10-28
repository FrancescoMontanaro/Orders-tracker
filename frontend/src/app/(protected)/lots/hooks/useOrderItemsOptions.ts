import * as React from 'react';
import { api } from '@/lib/api-client';
import type { SuccessResponse, Pagination } from '@/types/api';
import { useDebouncedValue } from './useDebouncedValue';
import type { OrderOption } from '../types/lot';

type OrdersListResponse = SuccessResponse<Pagination<OrderOption>>;

/**
 * Fetches orders (with items) to populate the lot association picker.
 * Supports search by customer name and ensures specific order IDs are available.
 */
export function useOrderItemsOptions(dialogOpen: boolean, seedOrderIds: number[] = []) {
  const [ordersMap, setOrdersMap] = React.useState<Map<number, OrderOption>>(new Map());
  const [pageOrders, setPageOrders] = React.useState<OrderOption[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebouncedValue(search, 350);
  const [page, setPage] = React.useState(1);
  const [size, setSize] = React.useState(10);
  const [total, setTotal] = React.useState(0);

  const mergeOrders = React.useCallback((list: OrderOption[]) => {
    setOrdersMap((prev) => {
      const next = new Map(prev);
      list.forEach((order) => {
        next.set(order.id, {
          id: order.id,
          customer_id: order.customer_id,
          customer_name: order.customer_name,
          delivery_date: order.delivery_date,
          items: Array.isArray(order.items)
            ? order.items.map((it) => ({
                id: it.id,
                product_id: it.product_id,
                product_name: it.product_name,
                unit: it.unit,
                quantity: it.quantity,
                lot_id: it.lot_id ?? null,
                lot_name: it.lot_name ?? null,
                lot_location: it.lot_location ?? null,
              }))
            : [],
        });
      });
      return next;
    });
  }, []);

  const fetchList = React.useCallback(async () => {
    if (!dialogOpen) return;
    setLoading(true);
    setError(null);
    try {
      const filters: Record<string, any> = {};
      if (debouncedSearch.trim()) {
        filters.customer_name = debouncedSearch.trim();
      }

      const res = await api.post<OrdersListResponse>(
        '/orders/list',
        {
          filters,
          sort: [
            { field: 'delivery_date', order: 'desc' },
            { field: 'id', order: 'desc' },
          ],
        },
        {
          params: { page, size },
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const payload = res.data.data;
      const incoming = Array.isArray(payload.items) ? payload.items : [];
      mergeOrders(incoming);
      setPageOrders(
        incoming.map((order) => ({
          ...order,
          items: Array.isArray(order.items) ? [...order.items] : [],
        }))
      );
      setTotal(Number(payload.total) || 0);
    } catch (e: any) {
      const detail =
        e?.response?.data?.detail ??
        e?.response?.data?.message ??
        e?.message ??
        'Errore sconosciuto';
      setError(`Impossibile caricare gli ordini: ${String(detail)}`);
    } finally {
      setLoading(false);
    }
  }, [dialogOpen, debouncedSearch, mergeOrders, page, size]);

  const fetchByIds = React.useCallback(
    async (ids: number[]) => {
      const missing = ids.filter((id) => !ordersMap.has(id));
      if (!missing.length) return;

      try {
        const results = await Promise.allSettled(
          missing.map((id) => api.get<SuccessResponse<OrderOption>>(`/orders/${id}`))
        );

        const fetched: OrderOption[] = [];
        results.forEach((res) => {
          if (res.status === 'fulfilled') {
            const order = res.value.data.data;
            if (order) {
              fetched.push(order);
            }
          }
        });

        if (fetched.length) {
          mergeOrders(fetched);
        }
      } catch (e) {
        // Swallow errors here; individual failures are fine.
      }
    },
    [mergeOrders, ordersMap]
  );

  React.useEffect(() => {
    if (!dialogOpen) return;
    fetchList();
  }, [dialogOpen, debouncedSearch, fetchList, page, size]);

  React.useEffect(() => {
    if (!dialogOpen || !seedOrderIds.length) return;
    fetchByIds(seedOrderIds);
  }, [dialogOpen, seedOrderIds, fetchByIds]);

  React.useEffect(() => {
    if (!dialogOpen) return;
    setPage(1);
  }, [dialogOpen, debouncedSearch]);

  const orders = React.useMemo(
    () =>
      pageOrders.slice().sort((a, b) => {
        const dateA = a.delivery_date ?? '';
        const dateB = b.delivery_date ?? '';
        if (dateA !== dateB) {
          return dateA > dateB ? -1 : 1;
        }
        return b.id - a.id;
      }),
    [pageOrders]
  );

  return {
    orders,
    loading,
    error,
    search,
    setSearch,
    refetch: fetchList,
    ensureOrders: fetchByIds,
    page,
    size,
    total,
    setPage,
    setSize,
  };
}
