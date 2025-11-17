'use client';

import * as React from 'react';
import { api } from '@/lib/api-client';
import type { Customer } from '../types/customer';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { MoreHorizontal } from 'lucide-react';

/**
 * Row actions for a single customer: edit, toggle archive, delete (with confirm).
 * Keeps the inert cleanup after closing the AlertDialog.
 */
export function RowActions({
  customer, onView, onEdit, onChanged, onError,
}: {
  customer: Customer;
  onView: (c: Customer) => void;
  onEdit: (c: Customer) => void;
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

  async function toggleArchive() {
    try {
      await api.patch(`/customers/${customer.id}`, { is_active: !customer.is_active });
      onChanged();
    } catch (e: any) {
      const detail =
        e?.response?.data?.detail ??
        e?.response?.data?.message ??
        e?.message ??
        'Errore sconosciuto';
      onError(`Aggiornamento stato non riuscito: ${String(detail)}`);
    }
  }

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
          <DropdownMenuItem onClick={() => onView(customer)}>Visualizza</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onEdit(customer)}>Modifica</DropdownMenuItem>
          <DropdownMenuItem onClick={toggleArchive}>
            {customer.is_active ? 'Archivia' : 'Ripristina'}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-red-600" onClick={requestDeleteOne}>
            Elimina
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Confirm delete for the row */}
      <AlertDialog open={confirmOpen} onOpenChange={handleConfirmOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare “{customer.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Questa azione non può essere annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                try {
                  await api.delete(`/customers/${customer.id}`);
                  handleConfirmOpenChange(false);
                  onChanged();
                } catch (e: any) {
                  const detail =
                    e?.response?.data?.detail ??
                    e?.response?.data?.message ??
                    e?.message ??
                    'Errore sconosciuto';
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
