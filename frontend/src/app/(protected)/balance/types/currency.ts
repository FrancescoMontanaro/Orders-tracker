// Simple Euro formatter utilities reused by table cells and dialogs.

export const euroFmt = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
});

/** Defensive cast to number to avoid "NaN" rendering on weird inputs. */
export const euro = (n: number) => euroFmt.format(Number(n));