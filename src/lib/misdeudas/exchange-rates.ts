import { isISODate } from "./dates.ts";

export type ExchangeReference = {
  base: "MXN";
  date: string;
  rates: {
    USD: number;
    EUR: number;
  };
};

/** Accept only the small, documented public payload the reference-rate UI needs. */
export function parseExchangeReference(value: unknown): ExchangeReference | null {
  if (!value || typeof value !== "object") return null;
  const payload = value as Record<string, unknown>;
  if (payload.base !== "MXN" || typeof payload.date !== "string" || !isISODate(payload.date)) {
    return null;
  }
  if (!payload.rates || typeof payload.rates !== "object") return null;
  const rates = payload.rates as Record<string, unknown>;
  const usd = rates.USD;
  const eur = rates.EUR;
  if (
    typeof usd !== "number" ||
    typeof eur !== "number" ||
    !Number.isFinite(usd) ||
    !Number.isFinite(eur) ||
    usd <= 0 ||
    eur <= 0 ||
    usd > 100 ||
    eur > 100
  ) {
    return null;
  }
  return { base: "MXN", date: payload.date, rates: { USD: usd, EUR: eur } };
}
