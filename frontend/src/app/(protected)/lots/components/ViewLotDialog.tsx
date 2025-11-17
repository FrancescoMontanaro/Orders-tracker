'use client';

import * as React from 'react';
import type { Lot } from '../types/lot';
import { formatLotDate } from '../utils/date';
import { euro } from '@/app/(protected)/orders/utils/currency';
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
  lot: Lot | null;
  onRequestEdit: (lot: Lot) => void;
};

export function ViewLotDialog({
  open,
  onOpenChange,
  lot,
  onRequestEdit,
}: Props) {
  const handleEdit = React.useCallback(() => {
    if (!lot) return;
    onOpenChange(false);
    onRequestEdit(lot);
  }, [lot, onOpenChange, onRequestEdit]);

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
          <DialogTitle>Dettagli lotto</DialogTitle>
          <DialogDescription>
            {lot ? lot.name : 'Seleziona un lotto da visualizzare.'}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto space-y-4 pr-1">
          {!lot ? (
            <p className="text-sm text-muted-foreground">Nessun lotto selezionato.</p>
          ) : (
            <>
              <section className="grid gap-3 sm:grid-cols-2">
                <Field label="ID" value={`#${lot.id}`} />
                <Field label="Data" value={formatLotDate(lot.lot_date)} />
                <Field label="Locazione" value={lot.location} />
              </section>

              <section className="space-y-2">
                <h4 className="text-sm font-semibold">Descrizione</h4>
                {lot.description ? (
                  <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{lot.description}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Nessuna descrizione.</p>
                )}
              </section>

              <section className="space-y-2">
                <h4 className="text-sm font-semibold">Ordini collegati</h4>
                {lot.order_items?.length ? (
                  <div className="rounded-md border">
                    <div className="max-h-64 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Ordine</TableHead>
                            <TableHead>Prodotto</TableHead>
                            <TableHead className="text-right">Qtà</TableHead>
                            <TableHead className="text-right">Prezzo</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {lot.order_items.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell>
                                <div className="font-medium leading-tight">
                                  #{item.order_id}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {formatLotDate(item.order_date)}
                                </div>
                                {item.customer_name && (
                                  <div className="text-xs text-muted-foreground">
                                    {item.customer_name}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="text-sm font-medium leading-tight break-words">
                                  {item.product_name ?? `#${item.product_id}`}
                                </div>
                                {item.product_unit && (
                                  <div className="text-xs text-muted-foreground">
                                    Unità: {item.product_unit}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-sm">
                                {item.quantity}
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-sm">
                                {euro(item.unit_price)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Nessun ordine collegato.</p>
                )}
              </section>
            </>
          )}
        </div>

        <DialogFooter className="flex-none mt-2 flex w-full flex-row items-center justify-between gap-2">
          <DialogClose asChild>
            <Button variant="outline">Chiudi</Button>
          </DialogClose>
          <Button onClick={handleEdit} disabled={!lot}>
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
