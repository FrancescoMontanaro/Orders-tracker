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