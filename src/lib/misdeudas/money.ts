import { stripControlCharacters } from "./sanitize.ts";

export function cents(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

export function money(value: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(cents(value));
}

export function formatPercent(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** Split an amount so the cents add up exactly. */
export function splitMoney(amount: number, percents: number[]): number[] {
  const totalCents = Math.round(cents(amount) * 100);
  if (percents.length === 0) return [];
  const raw = percents.map((percent) => (totalCents * percent) / 100);
  const floors = raw.map((value) => Math.floor(value));
  const left = totalCents - floors.reduce((sum, value) => sum + value, 0);
  const order = raw
    .map((value, index) => ({ index, frac: value - floors[index] }))
    .sort((a, b) => b.frac - a.frac);
  for (let i = 0; i < left; i += 1) floors[order[i % order.length]!.index] += 1;
  return floors.map((value) => value / 100);
}

export function equalPercents(count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(10000 / count) / 100;
  const values = Array.from({ length: count }, () => base);
  values[count - 1] = cents(100 - base * (count - 1));
  return values;
}

export function cleanText(value: string, max: number): string {
  return stripControlCharacters(value).trim().slice(0, max);
}
