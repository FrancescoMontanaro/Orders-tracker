'use client';

import * as React from 'react';
import type { Customer } from '../types/customer';
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
  customer: Customer | null;
  onRequestEdit: (customer: Customer) => void;
};

export function ViewCustomerDialog({
  open,
  onOpenChange,
  customer,
  onRequestEdit,
}: Props) {
  const handleEdit = React.useCallback(() => {
    if (!customer) return;
    onOpenChange(false);
    onRequestEdit(customer);
  }, [customer, onOpenChange, onRequestEdit]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="
          flex flex-col gap-4
          w-[calc(100vw-2rem)] sm:w-[26rem] md:w-[30rem] lg:w-[34rem]
          max-h-[75vh] overflow-hidden
        "
        style={{ maxHeight: 'min(80svh, 80dvh)' }}
      >
        <DialogHeader className="flex-none">
          <DialogTitle>Dettagli cliente</DialogTitle>
          <DialogDescription>
            {customer ? `ID #${customer.id}` : 'Seleziona un cliente dall’elenco.'}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto space-y-4">
          {!customer ? (
            <p className="text-sm text-muted-foreground">Nessun cliente selezionato.</p>
          ) : (
            <>
              <Field label="Nome" value={customer.name} />
              <Field
                label="Stato"
                value={(
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold',
                      customer.is_active
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {customer.is_active ? 'Attivo' : 'Non attivo'}
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
          <Button onClick={handleEdit} disabled={!customer}>
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
