'use client';

import * as React from 'react';
import type { IncomeCategory } from '../types/income';
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
  category: IncomeCategory | null;
  onRequestEdit: (category: IncomeCategory) => void;
};

export function ViewIncomeCategoryDialog({
  open,
  onOpenChange,
  category,
  onRequestEdit,
}: Props) {
  const handleEdit = React.useCallback(() => {
    if (!category) return;
    onOpenChange(false);
    onRequestEdit(category);
  }, [category, onOpenChange, onRequestEdit]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="
          flex flex-col gap-4
          w-[calc(100vw-2rem)] sm:w-[24rem] md:w-[28rem]
          max-h-[70vh] overflow-hidden
        "
        style={{ maxHeight: 'min(75svh, 75dvh)' }}
      >
        <DialogHeader className="flex-none space-y-1">
          <DialogTitle>Categoria entrata</DialogTitle>
          <DialogDescription>
            {category ? `ID #${category.id}` : 'Seleziona una categoria.'}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {!category ? (
            <p className="text-sm text-muted-foreground">Nessuna categoria selezionata.</p>
          ) : (
            <Field label="Descrizione" value={category.descr} />
          )}
        </div>

        <DialogFooter className="flex-none mt-2 flex w-full flex-row items-center justify-between gap-2">
          <DialogClose asChild>
            <Button variant="outline">Chiudi</Button>
          </DialogClose>
          <Button onClick={handleEdit} disabled={!category}>
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
