import assert from "node:assert/strict";
import test from "node:test";
import { dashboard, paymentNumber, viewPurchase } from "./calc.ts";
import type { Purchase } from "./types.ts";

const holidays = [{ date: "2026-12-25", localName: "Navidad" }];

function purchase(
  partial: Partial<Purchase> & Pick<Purchase, "operationDate" | "months">,
): Purchase {
  return {
    id: "x",
    description: "Prueba",
    totalAmount: 1200,
    monthlyPayment: 100,
    manualPayment: null,
    ownerId: "me",
    cardId: null,
    shares: [{ personId: "me", percent: 100 }],
    example: false,
    ...partial,
  };
}

test("cuenta un pago por cada mes cumplido, incluido el día de la compra", () => {
  const made = paymentNumber(purchase({ operationDate: "2026-02-12", months: 12 }), "2026-10-12");
  assert.equal(made, 9);
});

test("una compra de 10 meses iniciada el 15 dic 2025 ya está liquidada el 12 oct 2026", () => {
  const view = viewPurchase(
    purchase({ operationDate: "2025-12-15", months: 10, monthlyPayment: 899 }),
    "2026-10-12",
    [],
  );
  assert.equal(view.settled, true);
  assert.equal(view.paymentNumber, 10);
  assert.equal(view.remaining, 0);
});

test("el pago 11 de 12 con fecha 25 ene cae en Navidad y se corre al lunes", () => {
  const view = viewPurchase(
    purchase({ operationDate: "2026-01-25", months: 12, monthlyPayment: 750, manualPayment: 11 }),
    "2026-10-12",
    holidays,
  );
  assert.equal(view.paymentNumber, 11);
  assert.equal(view.nextDue, "2026-12-25");
  assert.equal(view.holidayName, "Navidad");
  assert.equal(view.chargeDate, "2026-12-28");
  assert.equal(view.remaining, 750);
  assert.equal(view.paid, 8250);
});

test("conserva el orden original cuando dos cargos tienen la misma fecha", () => {
  const first = purchase({
    id: "primera",
    operationDate: "2026-10-12",
    months: 12,
    manualPayment: 0,
  });
  const second = purchase({
    id: "segunda",
    operationDate: "2026-10-12",
    months: 12,
    manualPayment: 0,
  });
  const upcoming = dashboard(
    [first, second].map((item) => viewPurchase(item, "2026-10-12", [])),
  ).upcoming;
  assert.deepEqual(
    upcoming.map((item) => item.purchase.id),
    ["primera", "segunda"],
  );
});

test("reparte el faltante a partes iguales sin perder centavos", () => {
  const view = viewPurchase(
    purchase({
      operationDate: "2026-10-12",
      months: 3,
      monthlyPayment: 100,
      manualPayment: 1,
      shares: [
        { personId: "a", percent: 50 },
        { personId: "b", percent: 50 },
      ],
    }),
    "2026-10-12",
    [],
  );
  assert.equal(view.remaining, 200);
  assert.equal(view.shares[0]?.remaining, 100);
  assert.equal(view.shares[1]?.remaining, 100);
  assert.equal(
    view.shares.reduce((sum, share) => sum + share.remaining, 0),
    view.remaining,
  );
});
