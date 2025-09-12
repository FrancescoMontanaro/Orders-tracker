'use client';

import * as React from 'react';
import type { Note } from '../types/note';
import { Clock } from 'lucide-react';

type Props = {
  note: Note;
  fmtDate: (s: string) => string;
  onOpenView: (n: Note) => void;
  /** Se true: la card non apre il dialog, ma toggla la selezione */
  selectMode?: boolean;
  /** Stato selezione corrente (controllato dal parent) */
  selected?: boolean;
  /** Toggle selezione (richiesto quando selectMode=true) */
  onToggleSelect?: (id: number) => void;
};

/**
 * Card di anteprima nota.
 * - selectMode=true: click su tutta la card seleziona/deseleziona.
 * - selectMode=false: click apre il dialog di sola visualizzazione.
 * - Il bordo di selezione è un ring **inset** (interno): non viene troncato.
 */
export function NoteCard({
  note, fmtDate, onOpenView,
  selectMode = false, selected = false, onToggleSelect,
}: Props) {
  const handleActivate = () => {
    if (selectMode) onToggleSelect?.(note.id);
    else onOpenView(note);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleActivate();
    }
  };

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={handleActivate}
      onKeyDown={handleKey}
      aria-pressed={selectMode ? selected : undefined}
      className={[
        // base
        'break-inside-avoid rounded-xl border p-3 shadow-sm transition-shadow',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        // palette giallina
        'bg-yellow-50/70 border-yellow-200/70',
        'dark:bg-yellow-800/30 dark:border-yellow-600/50',
        // hover
        'hover:shadow-md hover:bg-yellow-50/90',
        'dark:hover:bg-yellow-800/50',
        // selezione: ring **inset** (interno) così non viene troncato
        selected ? 'ring-inset ring-2 ring-yellow-500' : '',
      ].join(' ')}
      aria-label={selectMode ? 'Seleziona nota' : 'Apri la nota'}
      title={selectMode ? 'Seleziona nota' : 'Apri la nota'}
    >
      {/* Testo clamped; preserva newlines */}
      <p className="whitespace-pre-wrap break-words line-clamp-8 md:line-clamp-6 text-[0.95rem] leading-relaxed">
        {note.text}
      </p>

      {/* Meta */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          <span className="truncate">Creata: {fmtDate(note.created_at)}</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          <span className="truncate">Aggiornata: {fmtDate(note.updated_at)}</span>
        </span>
      </div>
    </article>
  );
}