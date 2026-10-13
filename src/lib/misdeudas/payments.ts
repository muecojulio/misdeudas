import { cents } from "./money.ts";
import type { Payable } from "./types.ts";

export type PayablePersonTotal = {
  personId: string;
  total: number;
  pending: number;
  paid: number;
  count: number;
  pendingCount: number;
  nextDue: string | null;
};

/** Group by recipient and the chosen due-date month, never the purchase date. */
export function summarizePayables(payables: Payable[], month?: string) {
  const byPerson = new Map<string, PayablePersonTotal>();
  let total = 0;
  let pending = 0;
  let paid = 0;
  let count = 0;
  let pendingCount = 0;

  for (const payable of payables) {
    if (month && payable.dueDate.slice(0, 7) !== month) continue;
    const row = byPerson.get(payable.personId) ?? {
      personId: payable.personId,
      total: 0,
      pending: 0,
      paid: 0,
      count: 0,
      pendingCount: 0,
      nextDue: null,
    };
    const amount = cents(payable.amount);
    row.total = cents(row.total + amount);
    row.count += 1;
    total = cents(total + amount);
    count += 1;
    if (payable.paid) {
      row.paid = cents(row.paid + amount);
      paid = cents(paid + amount);
    } else {
      row.pending = cents(row.pending + amount);
      row.pendingCount += 1;
      pending = cents(pending + amount);
      pendingCount += 1;
      if (!row.nextDue || payable.dueDate < row.nextDue) row.nextDue = payable.dueDate;
    }
    byPerson.set(payable.personId, row);
  }

  return { total, pending, paid, count, pendingCount, byPerson };
}
