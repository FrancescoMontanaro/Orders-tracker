'use client';

import * as React from 'react';
import { api } from '@/lib/api-client';
import { Product } from '../types/product';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';

/**
 * Edit dialog – stable widths; y-scroll only; footer aligned horizontally
 */
export function EditProductDialog({
  open, onOpenChange, product, onSaved, onDeleted, onError,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  product: Product | null;
  onSaved: () => void;
  onDeleted: () => void;
  onError: (msg: string) => void;
}) {
  const [name, setName] = React.useState(product?.name ?? '');
  const [unitPrice, setUnitPrice] = React.useState<number>(product?.unit_price ?? 0);
  const [unit, setUnit] = React.useState<'Kg' | 'Px'>(product?.unit ?? 'Kg');
  const [isActive, setIsActive] = React.useState<boolean>(product?.is_active ?? true);
  const [saving, setSaving] = React.useState(false);
  const [localError, setLocalError] = React.useState<string | null>(null);

  // Confirm-delete (cleanup inert)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);
  const handleConfirmDeleteOpenChange = React.useCallback((o: boolean) => {
    setConfirmDeleteOpen(o);
    if (!o && typeof document !== 'undefined') {
      document.querySelectorAll('[inert]').forEach((el) => el.removeAttribute('inert'));
      (document.body as any).style.pointerEvents = '';
    }
  }, []);

  React.useEffect(() => {
    if (open && product) {
      setName(product.name);
      setUnitPrice(product.unit_price);
      setUnit(product.unit);
      setIsActive(product.is_active);
      setLocalError(null);
    }
  }, [open, product]);

  async function save() {
    if (!product) return;
    setSaving(true);
    setLocalError(null);
    try {
      await api.patch(`/products/${product.id}`, {
        name,
        unit_price: Number(unitPrice),
        unit,
        is_active: isActive,
      });
      onOpenChange(false);
      onSaved();
    } catch (e: any) {
      const detail =
        e?.response?.data?.detail ??
        e?.response?.data?.message ??
        e?.message ??
        'Errore sconosciuto';
      const msg = `Salvataggio non riuscito: ${String(detail)}`;
      setLocalError(msg);
      onError(msg);
    } finally {
      setSaving(false);
    }
  }

  function remove() {
    if (!product) return;
    setConfirmDeleteOpen(true);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="
          w-[calc(100vw-2rem)] sm:w-[28rem] md:w-[32rem] lg:w-[36rem]
          max-h-[80dvh] overflow-y-auto overflow-x-hidden
        ">
          <DialogHeader>
            <DialogTitle>Modifica prodotto</DialogTitle>
          </DialogHeader>

          {!product ? (
            <p className="text-sm text-muted-foreground">Nessun prodotto selezionato.</p>
          ) : (
            <div className="grid gap-3 min-w-0 max-w-full">
              <div className="grid gap-1 min-w-0">
                <Label>Nome</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} className="min-w-0 w-full max-w-full" />
              </div>

              <div className="grid gap-1 min-w-0">
                <Label>Prezzo unitario (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={String(unitPrice)}
                  onChange={(e) => setUnitPrice(Number(e.target.value))}
                  className="min-w-0 w-full max-w-full"
                />
              </div>

              <div className="grid gap-1 min-w-0">
                <Label>Unità</Label>
                <Select value={unit} onValueChange={(v: 'Kg' | 'Px') => setUnit(v)}>
                  <SelectTrigger className="min-w-0 w-full max-w-full"><SelectValue placeholder="Unità" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Kg">Kg</SelectItem>
                    <SelectItem value="Px">Px</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-1 min-w-0">
                <Label>Stato</Label>
                <Select
                  value={isActive ? 'active' : 'inactive'}
                  onValueChange={(v: 'active' | 'inactive') => setIsActive(v === 'active')}
                >
                  <SelectTrigger className="min-w-0 w-full max-w-full"><SelectValue placeholder="Stato" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Attivo</SelectItem>
                    <SelectItem value="inactive">Non attivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {localError && <p className="text-sm text-red-600">{localError}</p>}
            </div>
          )}

          {/* Footer: Delete left, Cancel/Save right; always on one line */}
          <DialogFooter className="mt-2 flex flex-row items-center justify-between gap-2">
            {product && (
              <Button variant="destructive" onClick={remove}>
                Elimina
              </Button>
            )}
            <div className="flex gap-2">
              <DialogClose asChild>
                <Button variant="outline">Annulla</Button>
              </DialogClose>
              <Button onClick={save} disabled={saving || !product}>
                {saving ? 'Salvataggio…' : 'Salva'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm delete (AlertDialog) */}
      <AlertDialog open={confirmDeleteOpen} onOpenChange={handleConfirmDeleteOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare questo prodotto?</AlertDialogTitle>
            <AlertDialogDescription>Questa azione non può essere annullata.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!product) return;
                try {
                  await api.delete(`/products/${product.id}`);
                  handleConfirmDeleteOpenChange(false);
                  onOpenChange(false);
                  onDeleted();
                } catch (e: any) {
                  const detail =
                    e?.response?.data?.detail ??
                    e?.response?.data?.message ??
                    e?.message ??
                    'Errore sconosciuto';
                  const msg = `Eliminazione non riuscita: ${String(detail)}`;
                  setLocalError(msg);
                  onError(msg);
                }
              }}
            >
              Conferma
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}