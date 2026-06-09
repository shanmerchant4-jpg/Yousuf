"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { PaymentMethod, CustomerStatus } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { computeStatus, extendPaidUntil } from "@/lib/billing";
import { getGraceDays } from "@/lib/settings";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function str(fd: FormData, k: string): string {
  return String(fd.get(k) ?? "").trim();
}
function optStr(fd: FormData, k: string): string | null {
  const v = str(fd, k);
  return v === "" ? null : v;
}
function optDate(fd: FormData, k: string): Date | null {
  const v = str(fd, k);
  return v === "" ? null : new Date(v);
}

/** Return the first ZodError message as a flat string, or a fallback. */
function zodMsg(err: z.ZodError): string {
  return err.issues[0]?.message ?? "Invalid input.";
}

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

// Loose phone: digits, spaces, dashes, +, parens — 7-15 chars when present
const phoneRegex = /^[0-9\s\-+()]{7,20}$/;
// Loose CNIC: 13 digits optionally separated with dashes  e.g. 42101-1234567-1
const cnicRegex = /^(\d{13}|\d{5}-\d{7}-\d)$/;

const CustomerSchema = z.object({
  fullName: z.string().min(1, "Name is required.").max(120, "Name too long."),
  panel: z.string().min(1, "Panel is required.").max(50, "Panel too long."),
  packageName: z.string().min(1, "Package is required.").max(80, "Package too long."),
  monthlyFee: z
    .number()
    .int("Monthly fee must be a whole number.")
    .min(0, "Monthly fee cannot be negative."),
  phone: z
    .string()
    .regex(phoneRegex, "Invalid phone number format.")
    .nullable()
    .optional(),
  cnic: z
    .string()
    .regex(cnicRegex, "CNIC must be 13 digits (with or without dashes).")
    .nullable()
    .optional(),
  address: z.string().max(200, "Address too long.").nullable().optional(),
  area: z.string().max(100, "Area too long.").nullable().optional(),
  notes: z.string().max(2000, "Notes too long.").nullable().optional(),
});

const PaymentSchema = z.object({
  customerId: z.string().min(1, "Missing customer."),
  amount: z
    .number()
    .int("Amount must be a whole number.")
    .min(1, "Amount must be greater than 0."),
  monthsCovered: z
    .number()
    .int("Months covered must be a whole number.")
    .min(1, "Months covered must be at least 1."),
  method: z.nativeEnum(PaymentMethod, { message: "Invalid payment method." }),
});

const StatusSchema = z.object({
  id: z.string().min(1, "Missing customer id."),
  status: z.nativeEnum(CustomerStatus, { message: "Invalid status value." }),
});

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export async function createCustomer(_prev: unknown, fd: FormData) {
  const session = await getSession();
  if (!session) return { error: "Not authenticated." };

  const parsed = CustomerSchema.safeParse({
    fullName: str(fd, "fullName"),
    panel: str(fd, "panel"),
    packageName: str(fd, "packageName"),
    monthlyFee: parseInt(str(fd, "monthlyFee") || "0", 10),
    phone: optStr(fd, "phone"),
    cnic: optStr(fd, "cnic"),
    address: optStr(fd, "address"),
    area: optStr(fd, "area"),
    notes: optStr(fd, "notes"),
  });
  if (!parsed.success) return { error: zodMsg(parsed.error) };

  const { fullName, panel, packageName, monthlyFee, phone, cnic, address, area, notes } =
    parsed.data;

  let customer: { id: string };
  try {
    customer = await db.customer.create({
      data: {
        fullName,
        phone: phone ?? null,
        cnic: cnic ?? null,
        address: address ?? null,
        area: area ?? null,
        panel,
        packageName,
        monthlyFee,
        installDate: optDate(fd, "installDate"),
        notes: notes ?? null,
        status: CustomerStatus.OVERDUE,
      },
    });
  } catch (e) {
    console.error("[createCustomer]", e);
    return { error: "Failed to create customer. Please try again." };
  }

  redirect(`/customers/${customer.id}`);
}

export async function updateCustomer(_prev: unknown, fd: FormData) {
  const session = await getSession();
  if (!session) return { error: "Not authenticated." };

  const id = str(fd, "id");
  if (!id) return { error: "Missing customer id." };

  const parsed = CustomerSchema.safeParse({
    fullName: str(fd, "fullName"),
    panel: str(fd, "panel"),
    packageName: str(fd, "packageName"),
    monthlyFee: parseInt(str(fd, "monthlyFee") || "0", 10),
    phone: optStr(fd, "phone"),
    cnic: optStr(fd, "cnic"),
    address: optStr(fd, "address"),
    area: optStr(fd, "area"),
    notes: optStr(fd, "notes"),
  });
  if (!parsed.success) return { error: zodMsg(parsed.error) };

  const { fullName, panel, packageName, monthlyFee, phone, cnic, address, area, notes } =
    parsed.data;

  try {
    await db.customer.update({
      where: { id },
      data: {
        fullName,
        phone: phone ?? null,
        cnic: cnic ?? null,
        address: address ?? null,
        area: area ?? null,
        panel,
        packageName,
        monthlyFee,
        installDate: optDate(fd, "installDate"),
        notes: notes ?? null,
      },
    });
  } catch (e) {
    console.error("[updateCustomer]", e);
    return { error: "Failed to update customer. Please try again." };
  }

  revalidatePath(`/customers/${id}`);
  return { ok: true };
}

export async function setStatus(_prev: unknown, fd: FormData) {
  const session = await getSession();
  if (!session) return { error: "Not authenticated." };

  const parsed = StatusSchema.safeParse({
    id: str(fd, "id"),
    status: str(fd, "status"),
  });
  if (!parsed.success) return { error: zodMsg(parsed.error) };

  const { id, status } = parsed.data;

  try {
    await db.customer.update({ where: { id }, data: { status } });
  } catch (e) {
    console.error("[setStatus]", e);
    return { error: "Failed to update status. Please try again." };
  }

  revalidatePath(`/customers/${id}`);
  return { ok: true };
}

export async function recordPayment(_prev: unknown, fd: FormData) {
  const session = await getSession();
  if (!session) return { error: "Not authenticated." };

  const parsed = PaymentSchema.safeParse({
    customerId: str(fd, "customerId"),
    amount: parseInt(str(fd, "amount") || "0", 10),
    monthsCovered: parseInt(str(fd, "monthsCovered") || "1", 10),
    method: str(fd, "method") || "CASH",
  });
  if (!parsed.success) return { error: zodMsg(parsed.error) };

  const { customerId, amount, monthsCovered, method } = parsed.data;
  const note = optStr(fd, "note");
  const paidOn = optDate(fd, "paidOn") ?? new Date();

  let customer: { id: string; paidUntil: Date | null } | null;
  try {
    customer = await db.customer.findUnique({
      where: { id: customerId },
      select: { id: true, paidUntil: true },
    });
  } catch (e) {
    console.error("[recordPayment] findUnique", e);
    return { error: "Failed to look up customer. Please try again." };
  }
  if (!customer) return { error: "Customer not found." };

  const newPaidUntil = extendPaidUntil(customer.paidUntil, monthsCovered, paidOn);
  const newStatus = computeStatus(newPaidUntil);

  try {
    await db.$transaction([
      db.payment.create({
        data: {
          customerId,
          amount,
          method,
          monthsCovered,
          paidOn,
          note,
          recordedById: session.staffId,
        },
      }),
      db.customer.update({
        where: { id: customerId },
        data: { paidUntil: newPaidUntil, status: newStatus },
      }),
    ]);
  } catch (e) {
    console.error("[recordPayment] transaction", e);
    return { error: "Failed to record payment. Please try again." };
  }

  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/");
  return { ok: true };
}

const PaidUntilSchema = z.object({
  id: z.string().min(1, "Missing customer id."),
});

/**
 * Manually set (or clear) a customer's paid-until date. An empty value clears
 * it. Status is recomputed from the new date using the configured grace window.
 * This is separate from recording a payment — use it to correct dates by hand.
 */
export async function setPaidUntil(_prev: unknown, fd: FormData) {
  const session = await getSession();
  if (!session) return { error: "Not authenticated." };

  const parsed = PaidUntilSchema.safeParse({ id: str(fd, "id") });
  if (!parsed.success) return { error: zodMsg(parsed.error) };
  const { id } = parsed.data;

  const raw = str(fd, "paidUntil");
  let paidUntil: Date | null = null;
  if (raw !== "") {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return { error: "Enter a valid date (or leave blank to clear)." };
    paidUntil = d;
  }

  const graceDays = await getGraceDays();
  const status = computeStatus(paidUntil, new Date(), graceDays);

  try {
    await db.customer.update({ where: { id }, data: { paidUntil, status } });
  } catch (e) {
    console.error("[setPaidUntil]", e);
    return { error: "Failed to update paid-until. Please try again." };
  }

  revalidatePath(`/customers/${id}`);
  revalidatePath("/");
  return { ok: true };
}


// ---------------------------------------------------------------------------
// Destructive per-customer actions
// ---------------------------------------------------------------------------

/** Permanently delete a customer and all their payments (cascade). */
export async function deleteCustomer(_prev: unknown, fd: FormData): Promise<{ error?: string; ok?: boolean }> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated." };

  const id = str(fd, "id");
  if (!id) return { error: "Missing customer id." };

  try {
    await db.customer.delete({ where: { id } });
  } catch (e) {
    console.error("[deleteCustomer]", e);
    return { error: "Failed to delete customer. Please try again." };
  }

  redirect("/customers");
}

/**
 * Remove a customer's payment data: delete every payment, clear paid-until and
 * reset status to OVERDUE. The customer record itself stays.
 */
export async function clearCustomerPayments(_prev: unknown, fd: FormData) {
  const session = await getSession();
  if (!session) return { error: "Not authenticated." };

  const id = str(fd, "id");
  if (!id) return { error: "Missing customer id." };

  try {
    await db.$transaction([
      db.payment.deleteMany({ where: { customerId: id } }),
      db.customer.update({
        where: { id },
        data: { paidUntil: null, status: CustomerStatus.OVERDUE },
      }),
    ]);
  } catch (e) {
    console.error("[clearCustomerPayments]", e);
    return { error: "Failed to remove payment data. Please try again." };
  }

  revalidatePath(`/customers/${id}`);
  revalidatePath("/");
  return { ok: true };
}
