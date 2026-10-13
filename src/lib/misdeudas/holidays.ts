import { FALLBACK_HOLIDAYS } from "./fallback-holidays.ts";
import { isISODate } from "./dates.ts";
import { stripControlCharacters } from "./sanitize.ts";
import type { Holiday } from "./types";

const CACHE_KEY = "misdeudas-holidays-cache-v1";
const WEEK = 7 * 24 * 60 * 60 * 1000;

export type HolidaySource = "vivo" | "cache" | "respaldo";

type CachedYear = {
  fetchedAt: number;
  days: Holiday[];
};

type CacheFile = {
  years: Record<string, CachedYear>;
};

function readCache(): CacheFile | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      fetchedAt?: unknown;
      years?: unknown;
    };
    if (!parsed.years || typeof parsed.years !== "object") return null;

    const years: CacheFile["years"] = {};
    const now = Date.now();
    const entries = Object.entries(parsed.years)
      .filter(([year]) => /^20\d{2}$/.test(year))
      .sort(([a], [b]) => Number(b) - Number(a))
      .slice(0, 4);
    for (const [year, entry] of entries) {
      if (!entry) continue;
      // Read the original v1 shape too, so an update does not discard saved calendars.
      const legacy = Array.isArray(entry);
      const candidate = legacy
        ? { fetchedAt: parsed.fetchedAt, days: entry }
        : (entry as { fetchedAt?: unknown; days?: unknown });
      if (
        typeof candidate.fetchedAt !== "number" ||
        !Number.isFinite(candidate.fetchedAt) ||
        candidate.fetchedAt <= 0 ||
        candidate.fetchedAt > now ||
        !Array.isArray(candidate.days)
      ) {
        continue;
      }
      const days = sanitizeYear(candidate.days, Number(year));
      if (days.length > 0) years[year] = { fetchedAt: candidate.fetchedAt, days };
    }
    return { years };
  } catch {
    return null;
  }
}

function writeYearCache(year: number, days: Holiday[]) {
  if (!Number.isInteger(year) || year < 2020 || year > 2036) return;
  const cleanDays = sanitizeYear(days, year);
  if (cleanDays.length === 0) return;
  try {
    // Merge at write time: adjacent-year requests resolve concurrently.
    const years = readCache()?.years ?? {};
    years[String(year)] = { fetchedAt: Date.now(), days: cleanDays };
    const entries = Object.entries(years)
      .sort(([a], [b]) => Number(b) - Number(a))
      .slice(0, 4);
    localStorage.setItem(CACHE_KEY, JSON.stringify({ years: Object.fromEntries(entries) }));
  } catch {
    // Private mode or full storage: the screen still works without a cache.
  }
}

function sanitize(days: unknown): Holiday[] {
  if (!Array.isArray(days)) return [];
  const clean: Holiday[] = [];
  for (const item of days.slice(0, 100)) {
    if (!item || typeof item !== "object") continue;
    const date = "date" in item ? String(item.date) : "";
    const localName = "localName" in item ? String(item.localName) : "";
    if (!isISODate(date) || !localName.trim()) continue;
    clean.push({
      date,
      localName: stripControlCharacters(localName).trim().slice(0, 80),
    });
  }
  return clean;
}

function sanitizeYear(days: unknown, year: number): Holiday[] {
  return sanitize(days).filter((holiday) => holiday.date.startsWith(`${year}-`));
}

export async function loadHolidays(
  year: number,
): Promise<{ days: Holiday[]; source: HolidaySource }> {
  if (!Number.isInteger(year) || year < 2020 || year > 2036) {
    return { days: [], source: "respaldo" };
  }
  const cache = readCache();
  const cached = cache?.years[String(year)];
  if (cached && Date.now() >= cached.fetchedAt && Date.now() - cached.fetchedAt < WEEK) {
    return { days: sanitizeYear(cached.days, year), source: "cache" };
  }
  try {
    const response = await fetch(`/api/holidays?year=${year}`, {
      headers: { accept: "application/json" },
    });
    if (!response.ok) throw new Error("holiday");
    const body = (await response.json()) as { source?: string; days?: unknown };
    const days = sanitizeYear(body.days, year);
    if (body.source === "live" && days.length > 0) {
      writeYearCache(year, days);
      return { days, source: "vivo" };
    }
    if (days.length > 0) return { days, source: "respaldo" };
    throw new Error("empty");
  } catch {
    if (cached?.days.length) return { days: sanitizeYear(cached.days, year), source: "cache" };
    return { days: FALLBACK_HOLIDAYS[year] ?? [], source: "respaldo" };
  }
}
