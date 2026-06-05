import { CustomerStatus } from "@prisma/client";

export const GRACE_DAYS = Number(process.env.GRACE_DAYS ?? "3");

/** Add whole months to a date, clamping day-of-month overflow (e.g. Jan 31 + 1mo = Feb 28). */
export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  const targetMonth = d.getMonth() + months;
  const result = new Date(d);
  result.setMonth(targetMonth);
  // handle overflow: if day rolled into next month, snap to last day of intended month
  if (result.getDate() < d.getDate()) {
    result.setDate(0);
  }
  return result;
}

/** Strip time -> midnight, for clean date comparisons. */
export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Given a paidUntil date, return the status the customer SHOULD have today.
 * - paid through today or later     -> ACTIVE
 * - past due but within grace days  -> OVERDUE
 * - past grace window               -> SUSPENDED
 * DISCONNECTED is a manual/sticky state and is never auto-changed here.
 */
export function computeStatus(
  paidUntil: Date | null,
  today: Date = new Date(),
  graceDays: number = GRACE_DAYS,
): CustomerStatus {
  if (!paidUntil) return CustomerStatus.OVERDUE;
  const due = startOfDay(paidUntil);
  const now = startOfDay(today);
  if (now <= due) return CustomerStatus.ACTIVE;
  const graceEnd = new Date(due);
  graceEnd.setDate(graceEnd.getDate() + graceDays);
  if (now <= graceEnd) return CustomerStatus.OVERDUE;
  return CustomerStatus.SUSPENDED;
}

/**
 * New paidUntil after a payment covering `months` months.
 * Extends from whichever is later: the current paidUntil, or today.
 * (So paying early stacks; paying late doesn't credit the gap.)
 */
export function extendPaidUntil(
  currentPaidUntil: Date | null,
  months: number,
  payDate: Date = new Date(),
): Date {
  const base =
    currentPaidUntil && startOfDay(currentPaidUntil) > startOfDay(payDate)
      ? currentPaidUntil
      : payDate;
  return addMonths(base, months);
}

export function formatPKR(amount: number): string {
  return "Rs " + amount.toLocaleString("en-PK");
}

export function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-PK", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
