'use client';

import * as React from 'react';
import type { Product } from '../types/product';
import { euro } from '../utils/currency';
import { cn } from '@/lib/utils';
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

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  product: Product | null;
  onRequestEdit: (product: Product) => void;
};

export function ViewProductDialog({
  open,
  onOpenChange,
  product,
  onRequestEdit,
}: Props) {
  const handleEdit = React.useCallback(() => {
    if (!product) return;
    onOpenChange(false);
    onRequestEdit(product);
  }, [product, onOpenChange, onRequestEdit]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="
          flex flex-col gap-4
          w-[calc(100vw-2rem)] sm:w-[28rem] md:w-[32rem] lg:w-[36rem]
          max-h-[80vh] overflow-hidden
        "
        style={{ maxHeight: 'min(82svh, 82dvh)' }}
      >
        <DialogHeader className="flex-none">
          <DialogTitle>Dettagli prodotto</DialogTitle>
          <DialogDescription className="text-sm">
            {product ? `ID #${product.id}` : 'Seleziona un prodotto per visualizzare i dettagli.'}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto space-y-4">
          {!product ? (
            <p className="text-sm text-muted-foreground">Nessun prodotto selezionato.</p>
          ) : (
            <>
              <Field label="Nome" value={product.name} />
              <Field label="Prezzo unitario" value={<span className="tabular-nums">{euro(product.unit_price)}</span>} />
              <Field label="Unità" value={product.unit} />
              <Field
                label="Stato"
                value={(
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold',
                      product.is_active
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {product.is_active ? 'Attivo' : 'Non attivo'}
                  </span>
                )}
              />
            </>
          )}
        </div>

        <DialogFooter className="flex-none mt-2 flex w-full flex-row items-center justify-between gap-2">
          <DialogClose asChild>
            <Button variant="outline">Chiudi</Button>
          </DialogClose>
          <Button onClick={handleEdit} disabled={!product}>
            Modifica
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-1 text-sm">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="font-medium break-words">{value ?? '—'}</div>
    </div>
  );
}
