import { createFileRoute } from "@tanstack/react-router";
import { parseExchangeReference } from "@/lib/misdeudas/exchange-rates";

/**
 * Optional, on-demand public reference rates. The upstream receives only fixed
 * currency codes; no amounts, account data, names, or card details are sent.
 */
export const Route = createFileRoute("/api/exchange-rates")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        if (
          url.searchParams.get("base") !== "MXN" ||
          url.searchParams.get("symbols") !== "USD,EUR"
        ) {
          return Response.json({ error: "Consulta no válida" }, { status: 400 });
        }

        try {
          const upstreamUrl = new URL("https://api.frankfurter.dev/v1/latest");
          upstreamUrl.searchParams.set("base", "MXN");
          upstreamUrl.searchParams.set("symbols", "USD,EUR");
          const upstream = await fetch(upstreamUrl, {
            headers: { accept: "application/json" },
            signal: AbortSignal.timeout(6000),
          });
          if (!upstream.ok) throw new Error("upstream");
          const rates = parseExchangeReference(await upstream.json());
          if (!rates) throw new Error("invalid response");
          return Response.json(rates, {
            headers: {
              "cache-control": "public, max-age=1800, s-maxage=3600, stale-while-revalidate=86400",
              "x-content-type-options": "nosniff",
            },
          });
        } catch {
          return Response.json(
            { error: "El servicio público no está disponible por ahora." },
            {
              status: 503,
              headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" },
            },
          );
        }
      },
    },
  },
});
