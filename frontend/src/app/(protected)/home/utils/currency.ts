// Small EUR helpers shared across the Home page

export const euroFmt = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const euro = (n?: number | null) => euroFmt.format(Number(n ?? 0));