'use client';

import * as React from 'react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';

/**
 * Add dialog for creating a new note.
 * - Minimal, focused on content.
 * - Clears state on open.
 */
export function AddNoteDialog({
  open, onOpenChange, onCreated, onError,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: () => void;
  onError: (msg: string) => void;
}) {
  const [text, setText] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [localError, setLocalError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setText('');
      setLocalError(null);
    }
  }, [open]);

  async function create() {
    if (!text.trim()) {
      setLocalError('Il testo è obbligatorio.');
      return;
    }
    setSaving(true);
    setLocalError(null);
    try {
      await api.post('/notes/', { text: text.trim() }, { headers: { 'Content-Type': 'application/json' } });
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
      <DialogContent className="w-[calc(100vw-2rem)] sm:w-[28rem] md:w-[32rem] lg:w-[36rem] max-h-[80dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuova nota</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-1">
            <Label>Testo</Label>
            <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Scrivi la tua nota…"
                className="min-h-[24rem] resize-y" 
            />
          </div>
          {localError && <p className="text-sm text-red-600">{localError}</p>}
        </div>

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