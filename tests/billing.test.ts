import { describe, it, expect } from "vitest";
import {
  addMonths,
  computeStatus,
  extendPaidUntil,
  formatPKR,
} from "../src/lib/billing";
import { CustomerStatus } from "@prisma/client";

// Helper: build a local-midnight Date from year/month(1-based)/day
function d(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day);
}

// Helper: extract local YYYY-MM-DD string so comparisons are timezone-safe
function ymd(date: Date): string {
  return (
    date.getFullYear() +
    "-" +
    String(date.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(date.getDate()).padStart(2, "0")
  );
}

// ---------------------------------------------------------------------------
// addMonths
// ---------------------------------------------------------------------------
describe("addMonths", () => {
  it("adds one month to a normal mid-month date", () => {
    expect(ymd(addMonths(d(2024, 1, 15), 1))).toBe("2024-02-15");
  });

  it("adds multiple months across a year boundary", () => {
    // Nov 30 + 3 months -> Feb 28 (non-leap)
    expect(ymd(addMonths(d(2023, 11, 30), 3))).toBe("2024-02-29");
  });

  it("rolls over from December to January (year rollover)", () => {
    expect(ymd(addMonths(d(2023, 12, 31), 1))).toBe("2024-01-31");
  });

  it("clamps Jan 31 + 1 month to Feb 28 in a non-leap year", () => {
    expect(ymd(addMonths(d(2023, 1, 31), 1))).toBe("2023-02-28");
  });

  it("clamps Jan 31 + 1 month to Feb 29 in a leap year", () => {
    expect(ymd(addMonths(d(2024, 1, 31), 1))).toBe("2024-02-29");
  });

  it("clamps Mar 31 + 1 month to Apr 30", () => {
    expect(ymd(addMonths(d(2023, 3, 31), 1))).toBe("2023-04-30");
  });

  it("adds 12 months to Feb 29 (leap) and clamps to Feb 28 next year", () => {
    expect(ymd(addMonths(d(2024, 2, 29), 12))).toBe("2025-02-28");
  });

  it("returns a new Date object (does not mutate input)", () => {
    const input = d(2024, 1, 15);
    const result = addMonths(input, 1);
    expect(result).not.toBe(input);
    expect(ymd(input)).toBe("2024-01-15");
  });
});

// ---------------------------------------------------------------------------
// computeStatus
// ---------------------------------------------------------------------------
describe("computeStatus", () => {
  const GRACE = 3;

  it("returns ACTIVE when today is before paidUntil", () => {
    const paidUntil = d(2024, 4, 10);
    const today = d(2024, 4, 9);
    expect(computeStatus(paidUntil, today, GRACE)).toBe(CustomerStatus.ACTIVE);
  });

  it("returns ACTIVE when today equals paidUntil (boundary: still paid)", () => {
    const paidUntil = d(2024, 4, 10);
    const today = d(2024, 4, 10);
    expect(computeStatus(paidUntil, today, GRACE)).toBe(CustomerStatus.ACTIVE);
  });

  it("returns OVERDUE one day after paidUntil (inside grace window)", () => {
    const paidUntil = d(2024, 4, 10);
    const today = d(2024, 4, 11);
    expect(computeStatus(paidUntil, today, GRACE)).toBe(CustomerStatus.OVERDUE);
  });

  it("returns OVERDUE on the last day of the grace window", () => {
    // paidUntil Apr 10, grace 3 days -> graceEnd Apr 13; today Apr 13 -> OVERDUE
    const paidUntil = d(2024, 4, 10);
    const today = d(2024, 4, 13);
    expect(computeStatus(paidUntil, today, GRACE)).toBe(CustomerStatus.OVERDUE);
  });

  it("returns SUSPENDED one day past the grace window", () => {
    // graceEnd Apr 13; today Apr 14 -> SUSPENDED
    const paidUntil = d(2024, 4, 10);
    const today = d(2024, 4, 14);
    expect(computeStatus(paidUntil, today, GRACE)).toBe(
      CustomerStatus.SUSPENDED,
    );
  });

  it("returns OVERDUE when paidUntil is null", () => {
    expect(computeStatus(null, d(2024, 4, 10), GRACE)).toBe(
      CustomerStatus.OVERDUE,
    );
  });

  it("works with graceDays = 0 (OVERDUE only on paidUntil+1, SUSPENDED on paidUntil+1 with 0 grace)", () => {
    // grace=0: graceEnd == due, so day after due -> now > graceEnd -> SUSPENDED
    const paidUntil = d(2024, 4, 10);
    expect(computeStatus(paidUntil, d(2024, 4, 11), 0)).toBe(
      CustomerStatus.SUSPENDED,
    );
  });

  it("ignores time-of-day on paidUntil (strips to midnight)", () => {
    // paidUntil has non-midnight time; today is same calendar day -> still ACTIVE
    const paidUntil = new Date(2024, 3, 10, 23, 59, 59); // Apr 10 23:59:59
    const today = new Date(2024, 3, 10, 0, 0, 0); // Apr 10 00:00:00
    expect(computeStatus(paidUntil, today, GRACE)).toBe(CustomerStatus.ACTIVE);
  });
});

// ---------------------------------------------------------------------------
// extendPaidUntil
// ---------------------------------------------------------------------------
describe("extendPaidUntil", () => {
  const payDate = d(2024, 4, 1); // Apr 1 2024

  it("extends from a future paidUntil (stacking early payment)", () => {
    const futurePaid = d(2024, 6, 15); // Jun 15 - after payDate
    expect(ymd(extendPaidUntil(futurePaid, 1, payDate))).toBe("2024-07-15");
  });

  it("extends from payDate when paidUntil is in the past", () => {
    const pastPaid = d(2024, 2, 1); // Feb 1 - before payDate
    expect(ymd(extendPaidUntil(pastPaid, 1, payDate))).toBe("2024-05-01");
  });

  it("extends from payDate when paidUntil is null", () => {
    expect(ymd(extendPaidUntil(null, 1, payDate))).toBe("2024-05-01");
  });

  it("extends from payDate when paidUntil equals payDate (not strictly greater)", () => {
    const samePaid = d(2024, 4, 1); // same as payDate
    expect(ymd(extendPaidUntil(samePaid, 1, payDate))).toBe("2024-05-01");
  });

  it("extends from paidUntil when paidUntil is one day after payDate", () => {
    const oneDayAhead = d(2024, 4, 2);
    expect(ymd(extendPaidUntil(oneDayAhead, 1, payDate))).toBe("2024-05-02");
  });

  it("stacks multiple months from a future paidUntil", () => {
    const futurePaid = d(2024, 6, 15); // Jun 15
    expect(ymd(extendPaidUntil(futurePaid, 3, payDate))).toBe("2024-09-15");
  });

  it("extends from payDate and clamps end-of-month overflow", () => {
    // payDate = Jan 31 2024; +1 month should clamp to Feb 29 (leap year)
    const jan31 = d(2024, 1, 31);
    expect(ymd(extendPaidUntil(null, 1, jan31))).toBe("2024-02-29");
  });
});

// ---------------------------------------------------------------------------
// formatPKR
// ---------------------------------------------------------------------------
describe("formatPKR", () => {
  it("prefixes with 'Rs '", () => {
    expect(formatPKR(0)).toMatch(/^Rs /);
  });

  it("formats zero", () => {
    expect(formatPKR(0)).toBe("Rs 0");
  });

  it("formats a three-digit amount without comma", () => {
    expect(formatPKR(500)).toBe("Rs 500");
  });

  it("formats a four-digit amount with thousands separator", () => {
    expect(formatPKR(1000)).toBe("Rs 1,000");
  });

  it("formats a large amount with multiple thousands separators", () => {
    expect(formatPKR(1234567)).toBe("Rs 1,234,567");
  });

  it("formats a typical monthly fee", () => {
    expect(formatPKR(2500)).toBe("Rs 2,500");
  });
});
