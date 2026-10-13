import { createFileRoute } from "@tanstack/react-router";
import { FALLBACK_HOLIDAYS } from "@/lib/misdeudas/fallback-holidays";
import { isISODate } from "@/lib/misdeudas/dates";

/**
 * Live Mexico public holidays. The browser only sends a year.
 * Names, amounts and card endings never leave the device.
 */
export const Route = createFileRoute("/api/holidays")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const year = Number(new URL(request.url).searchParams.get("year"));
        if (!Number.isInteger(year) || year < 2020 || year > 2036) {
          return Response.json({ error: "Año no válido" }, { status: 400 });
        }
        try {
          const upstream = await fetch(
            `https://date.nager.at/api/v3/PublicHolidays/${year}/MX`,
            { headers: { accept: "application/json" }, signal: AbortSignal.timeout(8000) },
          );
          if (!upstream.ok) throw new Error("upstream");
          const raw = (await upstream.json()) as unknown;
          const days = Array.isArray(raw)
            ? raw.flatMap((item) => {
                if (!item || typeof item !== "object") return [];
                const date = "date" in item ? String(item.date) : "";
                const localName = "localName" in item ? String(item.localName) : "";
                if (!isISODate(date) || !localName) return [];
                return [{ date, localName: localName.slice(0, 80) }];
              })
            : [];
          if (days.length === 0) throw new Error("empty");
          return Response.json(
            { source: "live", days },
            { headers: { "cache-control": "public, max-age=86400" } },
          );
        } catch {
          return Response.json(
            { source: "fallback", days: FALLBACK_HOLIDAYS[year] ?? [] },
            { headers: { "cache-control": "public, max-age=3600" } },
          );
        }
      },
    },
  },
});
