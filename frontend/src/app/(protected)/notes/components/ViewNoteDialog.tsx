'use client';

import * as React from 'react';
import type { Note } from '../types/note';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
// (opzionale) se usi shadcn ScrollArea, scommenta:
// import { ScrollArea } from '@/components/ui/scroll-area';

export function ViewNoteDialog({
  open, onOpenChange, note, onRequestEdit, fmtDate,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  note: Note | null;
  onRequestEdit: (n: Note) => void;
  fmtDate: (s: string) => string;
}) {
  function goEdit() {
    if (!note) return;
    onOpenChange(false);
    onRequestEdit(note);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Contenitore flessibile: header/meta/footer fissi; SOLO il body scrolla */}
      <DialogContent
        className="
          flex flex-col gap-3
          w-[calc(100vw-2rem)] sm:w-[32rem] md:w-[40rem] lg:w-[48rem]
          max-h-[85vh] overflow-hidden
        "
        style={{ maxHeight: 'min(85svh, 85dvh)' }}
      >
        {/* HEADER (fisso) */}
        <DialogHeader className="flex-none">
          <DialogTitle>Nota</DialogTitle>
        </DialogHeader>

        {/* METADATI (fissi) */}
        <div className="flex-none text-xs text-muted-foreground">
          {note ? (
            <>
              <div>Creata: {fmtDate(note.created_at)}</div>
              <div>Aggiornata: {fmtDate(note.updated_at)}</div>
            </>
          ) : (
            <div>Nessuna nota selezionata.</div>
          )}
        </div>

        <Separator className="flex-none" />

        {/* BODY: UNICO ELEMENTO SCROLLABILE */}
        <div
          className="
            min-h-0 flex-1 overflow-y-auto overscroll-contain
            [-webkit-overflow-scrolling:touch]
            touch-pan-y
          "
          role="region"
          aria-label="Contenuto della nota"
          tabIndex={0}
        >
          {note && (
            <pre className="whitespace-pre-wrap break-words text-sm leading-relaxed">
              {note.text}
            </pre>
          )}
        </div>

        <Separator className="flex-none" />

        {/* FOOTER (fisso) */}
        <DialogFooter className="flex-none mt-2 flex w-full flex-row items-center justify-between gap-2">
          <DialogClose asChild>
            <Button variant="outline">Chiudi</Button>
          </DialogClose>
          <Button onClick={goEdit} disabled={!note}>
            Modifica
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}