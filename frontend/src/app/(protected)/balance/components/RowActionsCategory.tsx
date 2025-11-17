'use client';

import * as React from 'react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { MoreHorizontal } from 'lucide-react';

type ExpenseCategory = { id: number; descr: string };

/**
 * Row actions for a single category: edit and delete (with confirm).
 * Mirrors the Expenses row actions but adapted to categories endpoints and labels.
 */
export function RowActionsCategory({
  category, onView, onEdit, onChanged, onError,
}: {
  category: ExpenseCategory;
  onView: (c: ExpenseCategory) => void;
  onEdit: (c: ExpenseCategory) => void;
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

  function requestDeleteOne() {
    setConfirmOpen(true);
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
          <DropdownMenuItem onClick={() => onView(category)}>Visualizza</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onEdit(category)}>Modifica</DropdownMenuItem>
          <DropdownMenuItem className="text-red-600" onClick={requestDeleteOne}>
            Elimina
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Confirm delete for the row */}
      <AlertDialog open={confirmOpen} onOpenChange={handleConfirmOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare la categoria “{category.descr}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Questa azione non può essere annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                try {
                  await api.delete(`/expenses/categories/${category.id}`);
                  handleConfirmOpenChange(false);
                  onChanged();
                } catch (e: any) {
                  const detail = e?.response?.data?.detail ?? e?.response?.data?.message ?? e?.message ?? 'Errore sconosciuto';
                  onError(`Eliminazione non riuscita: ${String(detail)}`);
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
