// Formatting helpers are kept in utils so they can be shared inside the section.

export const euroFmt = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
});

/** Defensive cast to number to avoid "NaN" rendering on weird inputs. */
export const euro = (n: number) => euroFmt.format(Number(n));