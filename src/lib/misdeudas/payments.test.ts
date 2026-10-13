import assert from "node:assert/strict";
import test from "node:test";
import { formatMonth, isISOMonth } from "./dates.ts";
import { summarizePayables } from "./payments.ts";
import type { Payable } from "./types.ts";

function payable(overrides: Partial<Payable>): Payable {
  return {
    id: "pay-1",
    personId: "p-ana",
    description: "Despensa",
    amount: 100,
    dueDate: "2026-10-15",
    paid: false,
    ...overrides,
  };
}

test("monthly totals add each recipient's purchases using the due date and year", () => {
  const result = summarizePayables(
    [
      payable({ id: "a", amount: 150.25, dueDate: "2026-10-25" }),
      payable({ id: "b", amount: 49.75, dueDate: "2026-10-10" }),
      payable({ id: "c", personId: "p-luis", amount: 75 }),
      payable({ id: "d", amount: 999, dueDate: "2026-11-01" }),
      payable({ id: "e", amount: 888, dueDate: "2027-10-01" }),
    ],
    "2026-10",
  );

  assert.equal(result.pending, 275);
  assert.equal(result.total, 275);
  assert.equal(result.pendingCount, 3);
  assert.equal(result.byPerson.get("p-ana")?.pending, 200);
  assert.equal(result.byPerson.get("p-ana")?.pendingCount, 2);
  assert.equal(result.byPerson.get("p-ana")?.nextDue, "2026-10-10");
  assert.equal(result.byPerson.get("p-luis")?.pending, 75);
});

test("paid entries remain in history without increasing the outstanding monthly balance", () => {
  const entries = [
    payable({ id: "a", amount: 40, paid: true, dueDate: "2026-10-01" }),
    payable({ id: "b", amount: 60, dueDate: "2026-10-31" }),
    payable({ id: "c", personId: "p-luis", amount: 25, paid: true }),
  ];
  const result = summarizePayables(entries, "2026-10");
  assert.equal(result.total, 125);
  assert.equal(result.pending, 60);
  assert.equal(result.paid, 65);
  assert.equal(result.count, 3);
  assert.equal(result.pendingCount, 1);
  assert.deepEqual(result.byPerson.get("p-luis"), {
    personId: "p-luis",
    total: 25,
    pending: 0,
    paid: 25,
    count: 1,
    pendingCount: 0,
    nextDue: null,
  });
  assert.equal(result.byPerson.get("p-ana")?.nextDue, "2026-10-31");
  assert.equal(
    summarizePayables(
      entries.map((entry) => ({ ...entry, paid: false })),
      "2026-10",
    ).pending,
    125,
  );
});

test("cent totals are exact, and leaving the month out includes every due month", () => {
  const result = summarizePayables([
    payable({ id: "a", amount: 0.1, dueDate: "2026-12-31" }),
    payable({ id: "b", amount: 0.2, dueDate: "2027-01-01" }),
    payable({ id: "c", amount: 0.03, dueDate: "2027-01-31" }),
  ]);
  assert.equal(result.total, 0.33);
  assert.equal(result.byPerson.get("p-ana")?.pending, 0.33);
  assert.equal(result.byPerson.get("p-ana")?.nextDue, "2026-12-31");
});

test("an empty month has a zero balance and no recipient rows", () => {
  const result = summarizePayables([payable({})], "2026-11");
  assert.equal(result.pending, 0);
  assert.equal(result.paid, 0);
  assert.equal(result.count, 0);
  assert.equal(result.byPerson.size, 0);
  assert.equal(summarizePayables([]).pending, 0);
});

test("month labels and validation do not depend on UTC date parsing", () => {
  assert.equal(formatMonth("2026-10"), "octubre de 2026");
  assert.equal(formatMonth("2027-01"), "enero de 2027");
  for (const invalid of ["", "2026-1", "2026-00", "2026-13", "2026-10-01", "0000-01", "bad"]) {
    assert.equal(isISOMonth(invalid), false, invalid);
  }
  assert.equal(isISOMonth("2026-12"), true);
});
