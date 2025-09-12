// Utilities to group notes by recency/month/year

import type { Note } from '../types/note';

export type GroupedNotes = {
  last30d: Note[];
  monthsThisYear: { key: string; label: string; items: Note[] }[]; // key: 'YYYY-MM'
  years: { key: string; label: string; items: Note[] }[]; // key: 'YYYY'
};

/**
 * Group notes:
 * - last 30 days (created_at)
 * - per month for current year (Jan..current month)
 * - older than Jan 1st current year => per year
 */
export function groupNotesByPeriod(notes: Note[], now = new Date()): GroupedNotes {
  const itMonth = new Intl.DateTimeFormat('it-IT', { month: 'long' });
  const itMonthYear = new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' });

  // Normalize and sort by updated_at desc for recency within groups
  const parsed = notes
    .map((n) => ({
      ...n,
      _created: new Date(n.created_at),
      _updated: new Date(n.updated_at),
    }))
    .sort((a, b) => b._updated.getTime() - a._updated.getTime());

  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const ms30d = 30 * 24 * 60 * 60 * 1000;
  const last30dCut = new Date(now.getTime() - ms30d);

  const last30d: Note[] = [];
  const monthsMap = new Map<string, Note[]>(); // 'YYYY-MM' -> notes
  const yearsMap = new Map<string, Note[]>();  // 'YYYY'    -> notes

  for (const n of parsed) {
    const updated = (n as any)._updated as Date;

    if (updated >= last30dCut) {
      last30d.push(n);
      continue;
    }

    if (updated >= startOfYear) {
      const key = `${updated.getFullYear()}-${String(updated.getMonth() + 1).padStart(2, '0')}`;
      const arr = monthsMap.get(key) ?? [];
      arr.push(n);
      monthsMap.set(key, arr);
    } else {
      const key = String(updated.getFullYear());
      const arr = yearsMap.get(key) ?? [];
      arr.push(n);
      yearsMap.set(key, arr);
    }
  }

  // Build months list from Jan..current month, even if empty (keeps consistent ordering)
  const monthsThisYear: { key: string; label: string; items: Note[] }[] = [];
  const y = now.getFullYear();
  for (let m = 0; m <= now.getMonth(); m++) {
    const key = `${y}-${String(m + 1).padStart(2, '0')}`;
    const label = itMonthYear.format(new Date(y, m, 1)); // es. "gennaio 2025"
    monthsThisYear.push({ key, label, items: monthsMap.get(key) ?? [] });
  }

  // Years descending
  const years = Array.from(yearsMap.entries())
    .sort((a, b) => Number(b[0]) - Number(a[0]))
    .map(([key, items]) => ({
      key,
      label: key,
      items,
    }));

  return { last30d, monthsThisYear, years };
}