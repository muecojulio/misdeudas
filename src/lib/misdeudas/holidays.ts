import { FALLBACK_HOLIDAYS } from "./fallback-holidays";
import { isISODate } from "./dates";
import type { Holiday } from "./types";

const CACHE_KEY = "misdeudas-holidays-cache-v1";
const WEEK = 7 * 24 * 60 * 60 * 1000;

export type HolidaySource = "vivo" | "cache" | "respaldo";

type CacheFile = {
  fetchedAt: number;
  years: Record<string, Holiday[]>;
};

function readCache(): CacheFile | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheFile;
    if (!parsed || typeof parsed.fetchedAt !== "number" || !parsed.years) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(file: CacheFile) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(file));
  } catch {
    /* private mode or full storage: the screen still works */
  }
}

function sanitize(days: unknown): Holiday[] {
  if (!Array.isArray(days)) return [];
  const clean: Holiday[] = [];
  for (const item of days) {
    if (!item || typeof item !== "object") continue;
    const date = "date" in item ? String(item.date) : "";
    const localName = "localName" in item ? String(item.localName) : "";
    if (!isISODate(date) || !localName) continue;
    clean.push({ date, localName: localName.replace(/[\u0000-\u001F]/g, "").slice(0, 80) });
  }
  return clean;
}

export async function loadHolidays(year: number): Promise<{ days: Holiday[]; source: HolidaySource }> {
  const cache = readCache();
  const cached = cache?.years[String(year)];
  if (cache && cached && Date.now() - cache.fetchedAt < WEEK) {
    return { days: sanitize(cached), source: "cache" };
  }
  try {
    const response = await fetch(`/api/holidays?year=${year}`, { headers: { accept: "application/json" } });
    if (!response.ok) throw new Error("holiday");
    const body = (await response.json()) as { source?: string; days?: unknown };
    const days = sanitize(body.days);
    if (body.source === "live" && days.length > 0) {
      const next: CacheFile = {
        fetchedAt: Date.now(),
        years: { ...(cache?.years ?? {}), [String(year)]: days },
      };
      writeCache(next);
      return { days, source: "vivo" };
    }
    if (days.length > 0) return { days, source: "respaldo" };
    throw new Error("empty");
  } catch {
    if (cached && cached.length > 0) return { days: sanitize(cached), source: "cache" };
    return { days: FALLBACK_HOLIDAYS[year] ?? [], source: "respaldo" };
  }
}
