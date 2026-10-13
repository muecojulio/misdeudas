import assert from "node:assert/strict";
import test from "node:test";
import { sanitizePersistedState } from "./store.ts";

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
