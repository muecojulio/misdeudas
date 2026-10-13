import assert from "node:assert/strict";
import test from "node:test";
import { parseExchangeReference } from "./exchange-rates.ts";

test("accepts only finite MXN reference rates for both requested currencies", () => {
  assert.deepEqual(
    parseExchangeReference({
      amount: 1,
      base: "MXN",
      date: "2026-10-12",
      rates: { USD: 0.055, EUR: 0.047 },
    }),
    {
      base: "MXN",
      date: "2026-10-12",
      rates: { USD: 0.055, EUR: 0.047 },
    },
  );
});

test("rejects unexpected currencies, invalid dates, and unsafe numeric values", () => {
  assert.equal(
    parseExchangeReference({ base: "USD", date: "2026-10-12", rates: { USD: 1, EUR: 2 } }),
    null,
  );
  assert.equal(
    parseExchangeReference({ base: "MXN", date: "2026-02-30", rates: { USD: 1, EUR: 2 } }),
    null,
  );
  assert.equal(
    parseExchangeReference({ base: "MXN", date: "2026-10-12", rates: { USD: Infinity, EUR: 2 } }),
    null,
  );
  assert.equal(
    parseExchangeReference({ base: "MXN", date: "2026-10-12", rates: { USD: 1 } }),
    null,
  );
});
