'use client';

import * as React from 'react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';

/**
 * Add dialog; identical validations and API calls as before.
 * Resets internal state on open.
 */
export function AddCustomerDialog({
  open, onOpenChange, onCreated, onError,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: () => void;
  onError: (msg: string) => void;
}) {
  const [name, setName] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [localError, setLocalError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setName('');
      setLocalError(null);
    }
  }, [open]);

  async function create() {
    if (!name.trim()) {
      setLocalError('Il nome è obbligatorio.');
      return;
    }

    setSaving(true);
    setLocalError(null);
    try {
      await api.post(
        '/customers/',
        { name: name.trim() },
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
      {/* Fixed widths per breakpoint (stable), vertical scroll only, no horizontal overflow */}
      <DialogContent className="
        w-[calc(100vw-2rem)] sm:w-[28rem] md:w-[32rem] lg:w-[36rem]
        max-h-[80dvh] overflow-y-auto overflow-x-hidden
      ">
        <DialogHeader>
          <DialogTitle>Nuovo cliente</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 min-w-0 max-w-full">
          <div className="grid gap-1 min-w-0">
            <Label>Nome</Label>
            <Input
              placeholder="Es. Mario Rossi"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="min-w-0 w-full max-w-full"
            />
          </div>

          {localError && <p className="text-sm text-red-600">{localError}</p>}
        </div>

        {/* Side-by-side buttons, not full-width, right-aligned */}
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