/**
 * Small DOM helper to clean up stale "inert"/"aria-hidden"/pointer-events
 * outside Radix portals. This does not change behavior; it's only extracted
 * for clarity and reuse across components/hooks.
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