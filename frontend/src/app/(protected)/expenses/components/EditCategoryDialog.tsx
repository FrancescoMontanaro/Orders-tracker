'use client';

import * as React from 'react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';

type ExpenseCategory = { id: number; descr: string };

/**
 * Edit dialog for expense categories
 * - Minimal form: edit "descr" only.
 * - Same layout rules as other dialogs.
 */
export function EditCategoryDialog({
  open, onOpenChange, category, onSaved, onError,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  category: ExpenseCategory | null;
  onSaved: () => void;
  onError: (msg: string) => void;
}) {
  const [descr, setDescr] = React.useState<string>(category?.descr ?? '');
  const [saving, setSaving] = React.useState(false);
  const [localError, setLocalError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open && category) {
      setDescr(category.descr ?? '');
      setLocalError(null);
    }
  }, [open, category]);

  async function save() {
    if (!category) return;
    if (!descr.trim()) {
      setLocalError('La descrizione è obbligatoria.');
      return;
    }
    setSaving(true);
    setLocalError(null);
    try {
      await api.patch(`/expenses/categories/${category.id}`, {
        descr: descr.trim(),
      });
      onOpenChange(false);
      onSaved();
    } catch (e: any) {
      const detail = e?.response?.data?.detail ?? e?.response?.data?.message ?? e?.message ?? 'Errore sconosciuto';
      const msg = `Salvataggio non riuscito: ${String(detail)}`;
      setLocalError(msg);
      onError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="
          w-[calc(100vw-2rem)] sm:w-[28rem] md:w-[32rem] lg:w-[36rem]
          max-h-[80dvh] overflow-y-auto overflow-x-hidden
        "
      >
        <DialogHeader>
          <DialogTitle>Modifica categoria</DialogTitle>
        </DialogHeader>

        {!category ? (
          <p className="text-sm text-muted-foreground">Nessuna categoria selezionata.</p>
        ) : (
          <div className="grid gap-3 min-w-0 max-w-full">
            <div className="grid gap-1 min-w-0">
              <Label>Descrizione</Label>
              <Input
                placeholder="Es. Alimentari"
                value={descr}
                onChange={(e) => setDescr(e.target.value)}
                className="min-w-0 w-full max-w-full"
              />
            </div>

            {localError && <p className="text-sm text-red-600">{localError}</p>}
          </div>
        )}

        <DialogFooter className="mt-2 flex flex-row items-center justify-end gap-2">
          <DialogClose asChild>
            <Button variant="outline">Annulla</Button>
          </DialogClose>
          <Button onClick={save} disabled={saving || !category}>
            {saving ? 'Salvataggio…' : 'Salva'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}