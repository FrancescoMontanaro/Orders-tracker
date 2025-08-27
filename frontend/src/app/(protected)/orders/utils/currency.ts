// Currency helpers — centralized to avoid re-creating Intl instances across renders.

const euroFmt = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });

/** Format a number as EUR currency (null/undefined become 0). */
export const euro = (n?: number | null) => euroFmt.format(Number(n ?? 0));