import * as React from 'react';

// Any Radix layer that is still on screen: dialogs, alert dialogs and poppers
// (popover / select / dropdown content lives inside the popper wrapper).
// Radix does not render a `[data-radix-portal]` attribute anymore, so matching
// on it silently found nothing and the cleanup below ran while dialogs were
// still open — stripping the very attributes that keep taps from reaching the
// UI behind an overlay.
const OPEN_RADIX_LAYER =
  '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], [data-radix-popper-content-wrapper]';

// Safety net for Radix Dialog/Popover "inert/aria-hidden" leaks across pages.
// If no dialog is open, it cleans stray attributes that may lock the page.
export function useFixRadixInertLeak() {
  React.useEffect(() => {
    const fix = () => {
      const anyOpenDialog = document.querySelector(OPEN_RADIX_LAYER);
      if (anyOpenDialog) return;

      document
        .querySelectorAll<HTMLElement>('html [inert]:not([data-radix-portal] *)')
        .forEach((el) => el.removeAttribute('inert'));

      document
        .querySelectorAll<HTMLElement>('html [aria-hidden="true"]:not([data-radix-portal] *)')
        .forEach((el) => el.removeAttribute('aria-hidden'));

      document.body.style.pointerEvents = '';
      document.body.style.overflow = '';
    };

    const mo = new MutationObserver(() => setTimeout(fix, 0));
    mo.observe(document.documentElement, {
      subtree: true,
      attributes: true,
      attributeFilter: ['inert', 'aria-hidden', 'style', 'data-state'],
    });
    fix();
    return () => {
      mo.disconnect();
      fix();
    };
  }, []);
}