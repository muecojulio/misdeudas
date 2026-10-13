import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import type { PayableInput, Person } from "./types.ts";

// Install browser storage before importing the persisted Zustand store.
const storage = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
    clear: () => storage.clear(),
  },
});
const { exportPayload, sanitizePersistedState, useLedger, validatePayable } =
  await import("./store.ts");

const people: Person[] = [
  { id: "p-me", name: "Yo", isMe: true, example: false },
  { id: "p-ana", name: "Ana", isMe: false, example: false },
  { id: "p-luis", name: "Luis", isMe: false, example: false },
];
const input: PayableInput = {
  personId: "p-ana",
  description: "Despensa",
  amount: 100,
  dueDate: "2026-10-20",
};

beforeEach(() => {
  storage.clear();
  useLedger.setState({
    people: [...people],
    cards: [],
    purchases: [],
    payables: [],
    cleared: false,
  });
});

test("localStorage hydration strips invalid fields and restores safe relationships", () => {
  const state = sanitizePersistedState({
    people: [
      { id: "p-me", name: "Yo", isMe: true, example: false },
      { id: "p-ana", name: "Ana\u0000 López", isMe: true, example: true },
      { id: "p-ana", name: "Duplicada", isMe: false },
    ],
    cards: [
      { id: "c-nu", personId: "p-ana", name: "Nu", last4: "1234" },
      { id: "c-nu", personId: "p-ana", name: "Duplicada", last4: "5678" },
      { id: "c-orphan", personId: "missing", name: "BBVA", last4: "1234" },
    ],
    purchases: [
      {
        id: "x-viaje",
        description: "Viaje",
        operationDate: "2026-10-12",
        months: 12,
        totalAmount: 1200,
        monthlyPayment: 100,
        manualPayment: 20,
        ownerId: "p-ana",
        cardId: "missing",
        shares: [
          { personId: "p-ana", percent: 60 },
          { personId: "p-ana", percent: 20 },
          { personId: "missing", percent: 20 },
        ],
      },
      {
        id: "x-orphan",
        description: "Sin persona",
        operationDate: "2026-10-12",
        months: 12,
        totalAmount: 1200,
        monthlyPayment: 100,
        manualPayment: null,
        ownerId: "missing",
        cardId: null,
        shares: [{ personId: "missing", percent: 100 }],
      },
    ],
    theme: "neon",
    tab: "secreto",
    cleared: false,
    hydrated: true,
    setTheme: "not-a-function",
  });

  assert.ok(state);
  assert.deepEqual(
    state.people.map(({ id, name, isMe }) => ({ id, name, isMe })),
    [
      { id: "p-me", name: "Yo", isMe: true },
      { id: "p-ana", name: "Ana López", isMe: false },
    ],
  );
  assert.deepEqual(
    state.cards.map(({ id, personId }) => ({ id, personId })),
    [{ id: "c-nu", personId: "p-ana" }],
  );
  assert.equal(state.purchases.length, 1);
  assert.equal(state.purchases[0]?.manualPayment, 12);
  assert.equal(state.purchases[0]?.cardId, null);
  assert.deepEqual(state.purchases[0]?.shares, [{ personId: "p-ana", percent: 100 }]);
  assert.equal(state.theme, "system");
  assert.equal(state.tab, "resumen");
  assert.equal("hydrated" in state, false);
  assert.equal("setTheme" in state, false);
});

test("malformed snapshots are ignored and an intentionally cleared ledger keeps its local profile", () => {
  assert.equal(sanitizePersistedState(null), null);
  const cleared = sanitizePersistedState({
    people: "broken",
    cleared: true,
    purchases: [],
    cards: [],
  });
  assert.deepEqual(cleared?.people, [{ id: "p-me", name: "Yo", isMe: true, example: false }]);
  assert.equal(cleared?.cleared, true);
});

test("older local ledgers restore with no payables, and the new tab survives hydration", () => {
  const old = sanitizePersistedState({ people, cards: [], purchases: [] });
  assert.deepEqual(old?.payables, []);
  const restored = sanitizePersistedState({ people, payables: [], tab: "pagos" });
  assert.equal(restored?.tab, "pagos");
});

test("payable validation rejects nonexistent recipients, invalid dates and invalid amounts", () => {
  assert.equal(validatePayable(input, people), null);
  for (const patch of [
    { personId: "missing" },
    { personId: "p-me" },
    { description: " " },
    { dueDate: "2026-02-30" },
    { dueDate: "" },
    { amount: 0 },
    { amount: -5 },
    { amount: Number.NaN },
    { amount: Number.POSITIVE_INFINITY },
    { amount: 0.001 },
    { amount: 100_000_001 },
  ]) {
    assert.equal(typeof validatePayable({ ...input, ...patch }, people), "string");
  }
});

test("hydration removes corrupt payables, duplicate IDs and broken recipient relationships", () => {
  const valid = {
    ...input,
    id: "pay-good",
    description: " Despensa\u0000 ",
    amount: 10.126,
    paid: true,
  };
  const state = sanitizePersistedState({
    people,
    payables: [
      valid,
      { ...valid, amount: 999 },
      { ...valid, id: "orphan", personId: "missing" },
      { ...valid, id: "self", personId: "p-me" },
      { ...valid, id: "bad-date", dueDate: "2026-02-30" },
      { ...valid, id: "bad-amount", amount: -1 },
      { ...valid, id: "bad-paid", paid: "yes" },
      { ...valid, id: "bad-description", description: "\u0000" },
    ],
  });
  assert.deepEqual(state?.payables, [
    {
      ...input,
      id: "pay-good",
      description: "Despensa",
      amount: 10.13,
      paid: true,
    },
  ]);
});

test("payables can be created, paid, edited, undone and deleted without altering purchases", () => {
  assert.equal(
    useLedger.getState().savePayable({ ...input, description: " Despensa ", amount: 10.126 }),
    null,
  );
  const created = useLedger.getState().payables[0]!;
  assert.equal(created.description, "Despensa");
  assert.equal(created.amount, 10.13);
  assert.equal(created.paid, false);
  useLedger.getState().setPayablePaid(created.id, true);
  assert.equal(
    useLedger.getState().savePayable({ ...input, amount: 50, dueDate: "2026-11-05" }, created.id),
    null,
  );
  assert.equal(useLedger.getState().payables[0]?.paid, true);
  assert.equal(useLedger.getState().payables[0]?.dueDate, "2026-11-05");
  useLedger.getState().setPayablePaid(created.id, false);
  assert.equal(useLedger.getState().payables[0]?.paid, false);
  assert.deepEqual(useLedger.getState().purchases, []);
  useLedger.getState().removePayable(created.id);
  assert.deepEqual(useLedger.getState().payables, []);
  assert.ok(useLedger.getState().savePayable(input, created.id));
});

test("recipients referenced by either pending or paid entries cannot be removed", () => {
  useLedger.getState().savePayable(input);
  const id = useLedger.getState().payables[0]!.id;
  assert.match(useLedger.getState().removePerson("p-ana") ?? "", /pago/);
  useLedger.getState().setPayablePaid(id, true);
  assert.match(useLedger.getState().removePerson("p-ana") ?? "", /pago/);
  useLedger.getState().removePayable(id);
  assert.equal(useLedger.getState().removePerson("p-ana"), null);
});

test("removing examples retains recipients used in real payables, while clearing removes payables", () => {
  useLedger.setState({
    people: people.map((person) => (person.id === "p-ana" ? { ...person, example: true } : person)),
  });
  useLedger.getState().savePayable(input);
  useLedger.getState().removeExamples();
  assert.ok(useLedger.getState().people.some((person) => person.id === "p-ana"));
  assert.equal(useLedger.getState().payables.length, 1);
  useLedger.getState().clearAll();
  assert.deepEqual(useLedger.getState().payables, []);
  assert.equal(useLedger.getState().people.length, 1);
  assert.equal(useLedger.getState().cleared, true);
});

test("version 2 backups preserve payments and their paid status through export and import", () => {
  useLedger.getState().savePayable(input);
  useLedger.getState().setPayablePaid(useLedger.getState().payables[0]!.id, true);
  const backup = exportPayload(useLedger.getState());
  assert.equal(backup.version, 2);
  assert.equal(backup.payables.length, 1);
  assert.equal(backup.payables[0]?.paid, true);
  const raw = JSON.stringify(backup);
  useLedger.getState().clearAll();
  assert.equal(useLedger.getState().importBackup(raw), null);
  assert.deepEqual(useLedger.getState().payables, backup.payables);
});

test("legacy version 1 backups remain importable with an empty payments collection", () => {
  useLedger.getState().savePayable(input);
  assert.equal(
    useLedger.getState().importBackup(
      JSON.stringify({
        version: 1,
        people,
        cards: [],
        purchases: [],
      }),
    ),
    null,
  );
  assert.deepEqual(useLedger.getState().payables, []);
  assert.equal(useLedger.getState().people.length, 3);
});

test("invalid version 2 payments are rejected without replacing any current records", () => {
  useLedger.getState().savePayable(input);
  const current = useLedger.getState().payables;
  const base = { version: 2, people, cards: [], purchases: [] };
  const valid = { ...input, id: "pay-backup", paid: false };
  for (const patch of [
    {},
    { payables: [valid, valid] },
    { payables: [{ ...valid, personId: "missing" }] },
    { payables: [{ ...valid, dueDate: "2026-02-30" }] },
    { payables: [{ ...valid, amount: 0 }] },
  ]) {
    assert.ok(useLedger.getState().importBackup(JSON.stringify({ ...base, ...patch })));
    assert.deepEqual(useLedger.getState().payables, current);
  }
});
