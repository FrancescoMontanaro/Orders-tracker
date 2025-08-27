/**
 * Small DOM helpers used by hooks/components when cleaning stale "inert"/"aria-hidden".
 * These do not introduce any behavioral change; they are just extracted for clarity.
 */

export function clearStaleInertOutsideRadixPortals() {
  document
    .querySelectorAll<HTMLElement>('html [inert]:not([data-radix-portal] *)')
    .forEach((el) => el.removeAttribute('inert'));

  document
    .querySelectorAll<HTMLElement>('html [aria-hidden="true"]:not([data-radix-portal] *)')
    .forEach((el) => el.removeAttribute('aria-hidden'));

  document.body.style.pointerEvents = '';
  document.body.style.overflow = '';
}