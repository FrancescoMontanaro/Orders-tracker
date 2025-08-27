import * as React from 'react';
import { clearStaleInertOutsideRadixPortals } from '../utils/inert';

/**
 * Workaround for rare Radix UI edge-cases where the page remains "blocked"
 * after closing Dialog/AlertDialog (leftover `inert` / `aria-hidden`).
 * No functional change to your UX: it only cleans stale attributes/styles
 * when no dialog is currently open.
 */
export function useFixRadixInertLeak() {
  React.useEffect(() => {
    const fix = () => {
      const anyOpenDialog = document.querySelector(
        '[data-radix-portal] [role="dialog"][data-state="open"]'
      );
      if (anyOpenDialog) return;
      clearStaleInertOutsideRadixPortals();
    };

    const mo = new MutationObserver(() => setTimeout(fix, 0));
    mo.observe(document.documentElement, {
      subtree: true,
      attributes: true,
      attributeFilter: ['inert', 'aria-hidden', 'style', 'data-state'],
    });

    fix(); // initial sweep in case the page starts "locked"
    return () => {
      mo.disconnect();
      fix();
    };
  }, []);
}