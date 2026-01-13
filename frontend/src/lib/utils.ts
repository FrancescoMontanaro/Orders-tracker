// Import clsx for conditional className merging and type for input values
import { clsx, type ClassValue } from "clsx"
// Import twMerge to merge Tailwind CSS classes intelligently
import { twMerge } from "tailwind-merge"

/**
 * cn
 * Utility to combine and merge class names using clsx and twMerge.
 * Useful for conditional and dynamic Tailwind CSS class names.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * formatUnit
 * Format unit for display. Converts technical unit codes to user-friendly labels.
 * E.g., "PX" → "colli"
 */
export function formatUnit(unit?: string | null): string {
  if (!unit) return '';
  
  const unitMap: Record<string, string> = {
    'PX': 'Colli',
    'KG': 'Kg',
  };
  
  return unitMap[unit.toUpperCase()] ?? unit;
}