import * as React from 'react';

// Safety net for Radix Dialog/Popover "inert/aria-hidden" leaks across pages.
// If no dialog is open, it cleans stray attributes that may lock the page.
export function useFixRadixInertLeak() {
  React.useEffect(() => {
    const fix = () => {
      const anyOpenDialog = document.querySelector(
        '[data-radix-portal] [role="dialog"][data-state="open"]'
      );
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