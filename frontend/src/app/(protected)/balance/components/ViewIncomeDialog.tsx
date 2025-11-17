'use client';

import * as React from 'react';
import type { Income } from '../types/income';
import { fmtDate } from '../utils/date';
import { euro } from '../utils/currency';
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
  income: Income | null;
  onRequestEdit: (income: Income) => void;
};

export function ViewIncomeDialog({
  open,
  onOpenChange,
  income,
  onRequestEdit,
}: Props) {
  const handleEdit = React.useCallback(() => {
    if (!income) return;
    onOpenChange(false);
    onRequestEdit(income);
  }, [income, onOpenChange, onRequestEdit]);

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
        <DialogHeader className="flex-none space-y-1">
          <DialogTitle>Dettagli entrata</DialogTitle>
          <DialogDescription>
            {income ? `ID #${income.id}` : 'Seleziona una riga per visualizzare i dettagli.'}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto space-y-4">
          {!income ? (
            <p className="text-sm text-muted-foreground">Nessuna entrata selezionata.</p>
          ) : (
            <>
              <Field label="Data" value={<span className="tabular-nums">{fmtDate(income.timestamp)}</span>} />
              <Field label="Importo" value={<span className="font-semibold tabular-nums">{euro(income.amount)}</span>} />
              <Field label="Categoria" value={income.category} />

              <section className="space-y-2">
                <h4 className="text-sm font-semibold">Nota</h4>
                {income.note ? (
                  <pre className="whitespace-pre-wrap break-words text-sm leading-relaxed rounded-md border bg-muted/50 p-3">
                    {income.note}
                  </pre>
                ) : (
                  <p className="text-sm text-muted-foreground">Nessuna nota.</p>
                )}
              </section>
            </>
          )}
        </div>

        <DialogFooter className="flex-none mt-2 flex w-full flex-row items-center justify-between gap-2">
          <DialogClose asChild>
            <Button variant="outline">Chiudi</Button>
          </DialogClose>
          <Button onClick={handleEdit} disabled={!income}>
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
