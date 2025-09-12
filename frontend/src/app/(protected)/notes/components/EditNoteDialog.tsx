'use client';

import * as React from 'react';
import { api } from '@/lib/api-client';
import type { Note } from '../types/note';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';

/**
 * Dialog di modifica di una singola nota.
 * - Focus sul solo contenuto testuale.
 * - Conferma distruttiva tramite AlertDialog per l'eliminazione.
 */
export function EditNoteDialog({
  open, onOpenChange, note, onSaved, onDeleted, onError,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  note: Note | null;
  onSaved: () => void;
  onDeleted: () => void;
  onError: (msg: string) => void;
}) {
  const [text, setText] = React.useState(note?.text ?? '');
  const [saving, setSaving] = React.useState(false);
  const [localError, setLocalError] = React.useState<string | null>(null);

  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);

  React.useEffect(() => {
    if (open && note) {
      setText(note.text);
      setLocalError(null);
    }
  }, [open, note]);

  async function save() {
    if (!note) return;
    if (!text.trim()) {
      setLocalError('Il testo è obbligatorio.');
      return;
    }
    setSaving(true);
    setLocalError(null);
    try {
      await api.patch(`/notes/${note.id}`, { text: text.trim() });
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

  async function performDelete() {
    if (!note) return;
    try {
      await api.delete(`/notes/${note.id}`);
      setConfirmDeleteOpen(false);
      onOpenChange(false);
      onDeleted();
    } catch (e: any) {
      const detail =
        e?.response?.data?.detail ??
        e?.response?.data?.message ??
        e?.message ??
        'Errore sconosciuto';
      onError(`Eliminazione non riuscita: ${String(detail)}`);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        {/* Larghezze responsive fisse; solo scroll verticale */}
        <DialogContent className="w-[calc(100vw-2rem)] sm:w-[28rem] md:w-[32rem] lg:w-[36rem] max-h-[80dvh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>Modifica nota</DialogTitle>
          </DialogHeader>

          {!note ? (
            <p className="text-sm text-muted-foreground">Nessuna nota selezionata.</p>
          ) : (
            <div className="grid gap-3 min-w-0 max-w-full">
              <div className="grid gap-1">
                <Label>Testo</Label>
                <Textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Scrivi la tua nota…"
                    className="min-h-[18rem] resize-y" 
                />
              </div>
              {localError && <p className="text-sm text-red-600">{localError}</p>}
            </div>
          )}

          <DialogFooter className="mt-2 flex flex-row items-center justify-between gap-2">
            {note && (
              <Button variant="destructive" onClick={() => setConfirmDeleteOpen(true)}>
                Elimina
              </Button>
            )}
            <div className="flex gap-2">
              <DialogClose asChild>
                <Button variant="outline">Annulla</Button>
              </DialogClose>
              <Button onClick={save} disabled={saving || !note}>
                {saving ? 'Salvataggio…' : 'Salva'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Conferma eliminazione */}
      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare questa nota?</AlertDialogTitle>
            <AlertDialogDescription>
              Questa azione non può essere annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={performDelete}>Conferma</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}