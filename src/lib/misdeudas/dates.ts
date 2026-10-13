const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function todayISO(now = new Date()): string {
  return toISO(now);
}

export function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

const MONTH_NAMES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

export function isISOMonth(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value) && isISODate(`${value}-01`);
}

export function formatMonth(month: string): string {
  if (!isISOMonth(month)) return month;
  const [year, number] = month.split("-").map(Number);
  return `${MONTH_NAMES[number - 1]} de ${year}`;
}

export function formatDay(iso: string): string {
  if (!isISODate(iso)) return iso;
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function formatDayShort(iso: string): string {
  if (!isISODate(iso)) return iso;
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

export function addMonthsISO(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const target = new Date(y, m - 1 + months, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d, last));
  return toISO(target);
}

export function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return toISO(new Date(y, m - 1, d + days));
}

export function isWeekend(iso: string): boolean {
  const [y, m, d] = iso.split("-").map(Number);
  const day = new Date(y, m - 1, d).getDay();
  return day === 0 || day === 6;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
