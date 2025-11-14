'use client';

import * as React from 'react';
import { Lot } from '../types/lot';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { MoreHorizontal } from 'lucide-react';

/**
 * Row-level actions for a single lot.
 */
export function RowActions({
  lot,
  onView,
  onEdit,
  onChanged,
  onError,
}: {
  lot: Lot;
  onView: (lot: Lot) => void;
  onEdit: (lot: Lot) => void;
  onChanged: () => void;
  onError: (msg: string) => void;
}) {
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const handleConfirmOpenChange = React.useCallback((o: boolean) => {
    setConfirmOpen(o);
    if (!o && typeof document !== 'undefined') {
      document.querySelectorAll('[inert]').forEach((el) => el.removeAttribute('inert'));
      (document.body as any).style.pointerEvents = '';
    }
  }, []);

  async function deleteLot() {
    try {
      await api.delete(`/lots/${lot.id}`);
      handleConfirmOpenChange(false);
      onChanged();
    } catch (e: any) {
      const detail =
        e?.response?.data?.detail ??
        e?.response?.data?.message ??
        e?.message ??
        'Errore sconosciuto';
      const msg = `Eliminazione non riuscita: ${String(detail)}`;
      onError(msg);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="bottom" className="min-w-[10rem]">
          <DropdownMenuItem onClick={() => onView(lot)}>Visualizza</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onEdit(lot)}>Modifica</DropdownMenuItem>
          <DropdownMenuItem className="text-red-600" onClick={() => setConfirmOpen(true)}>
            Elimina
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={handleConfirmOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare “{lot.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              La lotta verrà scollegata da tutti gli ordini associati.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={deleteLot}>
              Conferma
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
