'use client';

import * as React from 'react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';

/**
 * Add dialog – responsive & stable width, y-scroll only
 */
export function AddProductDialog({
  open, onOpenChange, onCreated, onError,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: () => void;
  onError: (msg: string) => void;
}) {
  const [name, setName] = React.useState('');
  const [unitPrice, setUnitPrice] = React.useState<number>(0);
  const [unit, setUnit] = React.useState<'Kg' | 'Px'>('Kg');
  const [saving, setSaving] = React.useState(false);
  const [localError, setLocalError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setName('');
      setUnitPrice(0);
      setUnit('Kg');
      setLocalError(null);
    }
  }, [open]);

  async function create() {
    if (!name.trim()) {
      setLocalError('Il nome è obbligatorio.');
      return;
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      setLocalError('Il prezzo deve essere un numero ≥ 0.');
      return;
    }

    setSaving(true);
    setLocalError(null);
    try {
      await api.post(
        '/products/',
        { name: name.trim(), unit_price: Number(unitPrice), unit },
        { headers: { 'Content-Type': 'application/json' } }
      );
      onOpenChange(false);
      onCreated();
    } catch (e: any) {
      const detail =
        e?.response?.data?.detail ??
        e?.response?.data?.message ??
        e?.message ??
        'Errore sconosciuto';
      const msg = `Creazione non riuscita: ${String(detail)}`;
      setLocalError(msg);
      onError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* stable width per breakpoint; vertical scroll only */}
      <DialogContent className="
        w-[calc(100vw-2rem)] sm:w-[28rem] md:w-[32rem] lg:w-[36rem]
        max-h-[80dvh] overflow-y-auto overflow-x-hidden
      ">
        <DialogHeader>
          <DialogTitle>Nuovo prodotto</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 min-w-0 max-w-full">
          <div className="grid gap-1 min-w-0">
            <Label>Nome</Label>
            <Input
              placeholder="Nome prodotto"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="min-w-0 w-full max-w-full"
            />
          </div>

          <div className="grid gap-1 min-w-0">
            <Label>Prezzo unitario (€)</Label>
            <Input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={String(unitPrice)}
              onChange={(e) => setUnitPrice(Number(e.target.value))}
              className="min-w-0 w-full max-w-full"
            />
          </div>

          <div className="grid gap-1 min-w-0">
            <Label>Unità</Label>
            <Select value={unit} onValueChange={(v: 'Kg' | 'Px') => setUnit(v)}>
              <SelectTrigger className="min-w-0 w-full max-w-full">
                <SelectValue placeholder="Unità" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Kg">Kg</SelectItem>
                <SelectItem value="Px">Px</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {localError && <p className="text-sm text-red-600">{localError}</p>}
        </div>

        {/* side-by-side buttons, not full width */}
        <DialogFooter className="mt-2 flex flex-row items-center justify-end gap-2">
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