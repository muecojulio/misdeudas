import { addDaysISO, addMonthsISO, clamp, isWeekend } from "./dates.ts";
import { cents, splitMoney } from "./money.ts";
import type { Holiday, Purchase, Share } from "./types.ts";

export type ShareView = Share & {
  monthly: number;
  paid: number;
  remaining: number;
};

export type PurchaseView = {
  purchase: Purchase;
  paymentNumber: number;
  remainingMonths: number;
  paid: number;
  remaining: number;
  planTotal: number;
  nextDue: string | null;
  chargeDate: string | null;
  holidayName: string | null;
  weekend: boolean;
  settled: boolean;
  overdue: boolean;
  shares: ShareView[];
};

export function paymentsFromDate(operationDate: string, months: number, today: string): number {
  let count = 0;
  for (let i = 0; i < months; i += 1) {
    if (addMonthsISO(operationDate, i) <= today) count += 1;
    else break;
  }
  return count;
}

export function paymentNumber(purchase: Purchase, today: string): number {
  const auto = paymentsFromDate(purchase.operationDate, purchase.months, today);
  if (purchase.manualPayment == null) return auto;
  return clamp(Math.round(purchase.manualPayment), 0, purchase.months);
}

export function viewPurchase(purchase: Purchase, today: string, holidays: Holiday[]): PurchaseView {
  const number = paymentNumber(purchase, today);
  const remainingMonths = purchase.months - number;
  const paid = cents(purchase.monthlyPayment * number);
  const remaining = cents(purchase.monthlyPayment * remainingMonths);
  const planTotal = cents(purchase.monthlyPayment * purchase.months);
  const settled = remainingMonths <= 0;
  const nextDue = settled ? null : addMonthsISO(purchase.operationDate, number);
  const holiday = nextDue ? holidays.find((item) => item.date === nextDue) : undefined;
  const weekend = nextDue ? isWeekend(nextDue) : false;
  const chargeDate = nextDue ? nextBusinessDay(nextDue, holidays) : null;
  const monthlyParts = splitMoney(
    purchase.monthlyPayment,
    purchase.shares.map((share) => share.percent),
  );
  const paidParts = splitMoney(
    paid,
    purchase.shares.map((share) => share.percent),
  );
  const remainingParts = splitMoney(
    remaining,
    purchase.shares.map((share) => share.percent),
  );
  const shares: ShareView[] = purchase.shares.map((share, index) => ({
    ...share,
    monthly: monthlyParts[index] ?? 0,
    paid: paidParts[index] ?? 0,
    remaining: remainingParts[index] ?? 0,
  }));
  return {
    purchase,
    paymentNumber: number,
    remainingMonths,
    paid,
    remaining,
    planTotal,
    nextDue,
    chargeDate,
    holidayName: holiday?.localName ?? null,
    weekend,
    settled,
    overdue: Boolean(nextDue && nextDue < today),
    shares,
  };
}

export function nextBusinessDay(iso: string, holidays: Holiday[]): string {
  const closed = new Set(holidays.map((holiday) => holiday.date));
  let cursor = iso;
  for (let i = 0; i < 14; i += 1) {
    if (!isWeekend(cursor) && !closed.has(cursor)) return cursor;
    cursor = addDaysISO(cursor, 1);
  }
  return cursor;
}

export type PersonTotal = {
  personId: string;
  remaining: number;
  paid: number;
  monthly: number;
  active: number;
};

export function dashboard(views: PurchaseView[]) {
  const active = views.filter((view) => !view.settled);
  const remaining = cents(active.reduce((sum, view) => sum + view.remaining, 0));
  const paid = cents(views.reduce((sum, view) => sum + view.paid, 0));
  const monthly = cents(active.reduce((sum, view) => sum + view.purchase.monthlyPayment, 0));
  const byPerson = new Map<string, PersonTotal>();
  for (const view of views) {
    for (const share of view.shares) {
      const row = byPerson.get(share.personId) ?? {
        personId: share.personId,
        remaining: 0,
        paid: 0,
        monthly: 0,
        active: 0,
      };
      row.paid = cents(row.paid + share.paid);
      if (!view.settled) {
        row.remaining = cents(row.remaining + share.remaining);
        row.monthly = cents(row.monthly + share.monthly);
        row.active += 1;
      }
      byPerson.set(share.personId, row);
    }
  }
  const upcoming = active
    .filter((view) => view.nextDue)
    .slice()
    .sort((a, b) => a.nextDue!.localeCompare(b.nextDue!));
  return {
    remaining,
    paid,
    monthly,
    activeCount: active.length,
    settledCount: views.length - active.length,
    byPerson,
    upcoming,
  };
}
