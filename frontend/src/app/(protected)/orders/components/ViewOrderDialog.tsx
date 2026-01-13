'use client';

import * as React from 'react';
import type { Order } from '../types/order';
import { euro } from '../utils/currency';
import { fmtDate } from '../utils/date';
import { formatUnit } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  order: Order | null;
  onRequestEdit: (order: Order) => void;
};

export function ViewOrderDialog({
  open,
  onOpenChange,
  order,
  onRequestEdit,
}: Props) {
  const handleEdit = React.useCallback(() => {
    if (!order) return;
    onOpenChange(false);
    onRequestEdit(order);
  }, [order, onOpenChange, onRequestEdit]);

  const totalAmount = React.useMemo(() => {
    if (!order) return 0;
    if (order.total_amount != null) return order.total_amount;
    if (order.total_price != null) return order.total_price;
    if (order.items?.length) {
      return order.items.reduce((sum, item) => {
        const price = item.total_price ?? (item.unit_price != null ? item.unit_price * item.quantity : 0);
        return sum + (price || 0);
      }, 0);
    }
    return 0;
  }, [order]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="
          flex flex-col gap-4
          w-[calc(100vw-2rem)] sm:w-[32rem] md:w-[40rem] lg:w-[46rem]
          max-h-[85vh] overflow-hidden
        "
        style={{ maxHeight: 'min(85svh, 85dvh)' }}
      >
        <DialogHeader className="flex-none space-y-1">
          <DialogTitle>Dettagli ordine</DialogTitle>
          <DialogDescription className="text-sm">
            {order ? `Ordine #${order.id}` : 'Seleziona un ordine dalla tabella.'}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto space-y-4 pr-1">
          {!order ? (
            <p className="text-sm text-muted-foreground">Nessun ordine selezionato.</p>
          ) : (
            <>
              <section className="grid gap-3 sm:grid-cols-2">
                <Field label="Cliente" value={order.customer_name ?? `#${order.customer_id}`} />
                <Field label="Consegna" value={<span className="tabular-nums">{fmtDate(order.delivery_date)}</span>} />
                <Field label="Stato" value={mapStatus(order.status)} />
                <Field
                  label="Sconto applicato"
                  value={order.applied_discount != null ? `${order.applied_discount}%` : '—'}
                />
                <Field label="Totale" value={<span className="font-semibold tabular-nums">{euro(totalAmount)}</span>} />
              </section>

              <section className="space-y-2">
                <h4 className="text-sm font-semibold">Prodotti</h4>
                {order.items?.length ? (
                  <div className="rounded-md border">
                    <div className="overflow-x-auto md:max-h-64 md:overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Prodotto</TableHead>
                            <TableHead className="text-right">Qtà</TableHead>
                            <TableHead className="text-right">Prezzo</TableHead>
                            <TableHead>Lotto</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {order.items.map((item, idx) => (
                            <TableRow key={`${item.product_id}-${idx}`}>
                              <TableCell>
                                <div className="text-sm font-medium leading-tight break-words">{item.product_name ?? `#${item.product_id}`}</div>
                                {item.unit && (
                                  <div className="text-xs text-muted-foreground">Unità: {formatUnit(item.unit)}</div>
                                )}
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-sm">
                                {item.quantity}
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-sm">
                                {item.unit_price != null ? euro(item.unit_price) : '—'}
                              </TableCell>
                              <TableCell className="text-sm">
                                {item.lot_name ? (
                                  <>
                                    <div className="font-medium leading-tight">{item.lot_name}</div>
                                    {item.lot_location && (
                                      <div className="text-xs text-muted-foreground">{item.lot_location}</div>
                                    )}
                                  </>
                                ) : '—'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Nessun prodotto associato.</p>
                )}
              </section>
            </>
          )}
        </div>

        <DialogFooter className="flex-none mt-2 flex w-full flex-row items-center justify-between gap-2">
          <DialogClose asChild>
            <Button variant="outline">Chiudi</Button>
          </DialogClose>
          <Button onClick={handleEdit} disabled={!order}>
            Modifica
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-0.5 text-sm">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="font-medium break-words">{value ?? '—'}</div>
    </div>
  );
}

function mapStatus(status?: Order['status']) {
  if (status === 'delivered') return 'Consegnato';
  if (status === 'created') return 'Creato';
  return '—';
}
