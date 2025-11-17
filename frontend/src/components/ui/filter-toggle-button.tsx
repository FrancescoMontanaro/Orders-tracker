'use client';

import * as React from 'react';
import { Filter, ChevronDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type FilterToggleButtonProps = {
  open: boolean;
  onToggle: () => void;
  className?: string;
};

/**
 * Shared toggle button used to show/hide filters on both mobile and desktop layouts.
 */
export function FilterToggleButton({
  open,
  onToggle,
  className,
}: FilterToggleButtonProps) {
  return (
    <Button
      variant="outline"
      onClick={onToggle}
      className={cn('flex w-full items-center justify-between gap-2', className)}
    >
      <span className="flex items-center gap-2">
        <Filter className="h-4 w-4" />
        {open ? 'Nascondi filtri' : 'Mostra filtri'}
      </span>
      <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
    </Button>
  );
}
