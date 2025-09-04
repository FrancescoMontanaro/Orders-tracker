'use client';

import * as React from 'react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

type ExpenseCategory = { id: number; descr: string };

/**
 * Add dialog for expenses
 * - Adds required category select (category_id)
 * - Stable widths by breakpoint (no horizontal growth while typing)
 * - Vertical scrolling only; no horizontal overflow
 */
export function AddExpenseDialog({
  open, onOpenChange, onCreated, onError,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: () => void;
  onError: (msg: string) => void;
}) {
  const [timestamp, setTimestamp] = React.useState<string>('');
  const [amount, setAmount] = React.useState<number>(0);
  const [note, setNote] = React.useState<string>('');
  const [categoryId, setCategoryId] = React.useState<number | undefined>(undefined);

  const [saving, setSaving] = React.useState(false);
  const [localError, setLocalError] = React.useState<string | null>(null);

  // Categories state
  const [categories, setCategories] = React.useState<ExpenseCategory[]>([]);
  const [catLoading, setCatLoading] = React.useState(false);
  const [catError, setCatError] = React.useState<string | null>(null);

  // Reset form on open
  React.useEffect(() => {
    if (open) {
      setTimestamp('');
      setAmount(0);
      setNote('');
      setCategoryId(undefined);
      setLocalError(null);
      setCatError(null);
    }
  }, [open]);

  // Fetch categories (size = -1 to get all)
  React.useEffect(() => {
    if (!open) return;
    let active = true;
    (async () => {
      setCatLoading(true);
      setCatError(null);
      try {
        const res = await api.post(
          '/expenses/categories/list',
          { filters: {}, sort: [{ field: 'id', order: 'asc' as const }] },
          { params: { page: 1, size: -1 } }
        );
        const items: ExpenseCategory[] = res?.data?.data?.items ?? [];
        if (active) setCategories(items);
      } catch (e: any) {
        if (active) {
          setCatError(
            e?.response?.data?.detail ??
            e?.response?.data?.message ??
            e?.message ??
            'Errore categorie'
          );
        }
      } finally {
        if (active) setCatLoading(false);
      }
    })();
    return () => { active = false; };
  }, [open]);

  async function create() {
    if (!timestamp) {
      setLocalError('La data è obbligatoria.');
      return;
    }
    if (categoryId === undefined) {
      setLocalError('La categoria è obbligatoria.');
      return;
    }
    setSaving(true);
    setLocalError(null);
    try {
      await api.post(
        '/expenses/',
        { category_id: categoryId, timestamp, amount: Number(amount), note: note || null },
        { headers: { 'Content-Type': 'application/json' } }
      );
      onOpenChange(false);
      onCreated();
    } catch (e: any) {
      const detail = e?.response?.data?.detail ?? e?.response?.data?.message ?? e?.message ?? 'Errore sconosciuto';
      const msg = `Creazione non riuscita: ${String(detail)}`;
      setLocalError(msg);
      onError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Fixed width per breakpoint; y-scroll only; prevent x-overflow */}
      <DialogContent
        className="
          w-[calc(100vw-2rem)] sm:w-[28rem] md:w-[32rem] lg:w-[36rem]
          max-h-[80dvh] overflow-y-auto overflow-x-hidden
        "
      >
        <DialogHeader>
          <DialogTitle>Nuova spesa</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 min-w-0 max-w-full">
          <div className="grid gap-1 min-w-0">
            <Label>Data</Label>
            <DatePicker
              value={timestamp}
              onChange={setTimestamp}
              placeholder="Seleziona data"
              className="min-w-0 w-full max-w-full"
            />
          </div>

          {/* Category (required) */}
          <div className="grid gap-1 min-w-0">
            <Label>Categoria</Label>
            <Select
              disabled={catLoading}
              value={categoryId === undefined ? undefined : String(categoryId)}
              onValueChange={(v) => setCategoryId(Number(v))}
            >
              <SelectTrigger className="min-w-0 w-full max-w-full">
                <SelectValue placeholder={catLoading ? 'Caricamento…' : 'Seleziona categoria'} />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.descr}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {catError && <p className="text-xs text-red-600 mt-1">{catError}</p>}
          </div>

          <div className="grid gap-1 min-w-0">
            <Label>Importo</Label>
            <Input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={Number.isFinite(amount) ? String(amount) : ''}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="min-w-0 w-full max-w-full"
            />
          </div>

          <div className="grid gap-1 min-w-0">
            <Label>Nota</Label>
            <Input
              placeholder="Descrizione (opzionale)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="min-w-0 w-full max-w-full"
            />
          </div>

          {localError && <p className="text-sm text-red-600">{localError}</p>}
        </div>

        {/* Buttons: not full-width, wrap nicely on small screens */}
        <DialogFooter className="mt-2 flex flex-row flex-wrap items-center justify-end gap-2">
          <DialogClose asChild>
            <Button variant="outline">Annulla</Button>
          </DialogClose>
          <Button onClick={create} disabled={saving}>
            {saving ? 'Creazione…' : 'Crea'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}