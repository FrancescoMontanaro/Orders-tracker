// Date helpers for ISO formatting and month navigation (Italian UX)

export function toISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fmtDate(iso?: string) {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : iso;
}

export function firstDayOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function lastDayOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

export function addMonths(d: Date, delta: number) {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1);
}

export function isSameDate(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth() === b.getMonth() &&
         a.getDate() === b.getDate();
}

export function isToday(d: Date) {
  return isSameDate(d, new Date());
}

export function itMonthLabel(d: Date) {
  return d.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
}

export function startOfCalendarGrid(currentMonthFirst: Date) {
  // Build a Monday-first 6x7 grid start date
  const dow = currentMonthFirst.getDay();          // 0=Sun
  const mondayIndex = (dow + 6) % 7;               // Monday=0
  const gridStart = new Date(currentMonthFirst);
  gridStart.setDate(currentMonthFirst.getDate() - mondayIndex);
  return gridStart;
}