import assert from "node:assert/strict";
import test from "node:test";
import { FALLBACK_HOLIDAYS } from "./fallback-holidays.ts";
import { loadHolidays } from "./holidays.ts";

type StorageMock = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

function mockStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  const storage: StorageMock = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
  return () => {
    if (previous) Object.defineProperty(globalThis, "localStorage", previous);
    else Reflect.deleteProperty(globalThis, "localStorage");
  };
}

test("ignores future-dated cache entries", async () => {
  const cache = JSON.stringify({
    years: {
      2026: {
        fetchedAt: Date.now() + 60_000,
        days: [{ date: "2026-01-01", localName: "Fecha falsa" }],
      },
    },
  });
  const restoreStorage = mockStorage({ "misdeudas-holidays-cache-v1": cache });
  const previousFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => {
    requests += 1;
    throw new Error("offline");
  };
  try {
    const result = await loadHolidays(2026);
    assert.equal(result.source, "respaldo");
    assert.deepEqual(result.days, FALLBACK_HOLIDAYS[2026]);
    assert.equal(requests, 1);
  } finally {
    restoreStorage();
    globalThis.fetch = previousFetch;
  }
});

test("rejects cached dates from a different year", async () => {
  const cache = JSON.stringify({
    years: {
      2026: {
        fetchedAt: Date.now(),
        days: [{ date: "2027-01-01", localName: "Otro año" }],
      },
    },
  });
  const restoreStorage = mockStorage({ "misdeudas-holidays-cache-v1": cache });
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("offline");
  };
  try {
    const result = await loadHolidays(2026);
    assert.equal(result.source, "respaldo");
    assert.deepEqual(result.days, FALLBACK_HOLIDAYS[2026]);
  } finally {
    restoreStorage();
    globalThis.fetch = previousFetch;
  }
});

test("accepts only holidays belonging to the requested year", async () => {
  const restoreStorage = mockStorage();
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    Response.json({
      source: "live",
      days: [
        { date: "2026-01-01", localName: "Año Nuevo" },
        { date: "2027-01-01", localName: "Otro año" },
        { date: "2026-02-02", localName: "Día de la Constitución\u0000" },
      ],
    });
  try {
    const result = await loadHolidays(2026);
    assert.equal(result.source, "vivo");
    assert.deepEqual(result.days, [
      { date: "2026-01-01", localName: "Año Nuevo" },
      { date: "2026-02-02", localName: "Día de la Constitución" },
    ]);
  } finally {
    restoreStorage();
    globalThis.fetch = previousFetch;
  }
});

test("does not make requests for an unsupported year", async () => {
  const previousFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => {
    requests += 1;
    return Response.json({ source: "live", days: [] });
  };
  try {
    assert.deepEqual(await loadHolidays(2037), { days: [], source: "respaldo" });
    assert.equal(requests, 0);
  } finally {
    globalThis.fetch = previousFetch;
  }
});
