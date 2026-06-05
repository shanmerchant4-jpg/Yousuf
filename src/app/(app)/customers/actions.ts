"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { PaymentMethod, CustomerStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { computeStatus, extendPaidUntil } from "@/lib/billing";

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

export async function createCustomer(_prev: unknown, fd: FormData) {
  const fullName = str(fd, "fullName");
  const panel = str(fd, "panel");
  const packageName = str(fd, "packageName");
  const monthlyFee = parseInt(str(fd, "monthlyFee") || "0", 10);

  if (!fullName) return { error: "Name is required." };
  if (!panel) return { error: "Panel is required." };
  if (!packageName) return { error: "Package is required." };
  if (!Number.isFinite(monthlyFee) || monthlyFee < 0)
    return { error: "Monthly fee must be a valid number." };

  const customer = await db.customer.create({
    data: {
      fullName,
      phone: optStr(fd, "phone"),
      cnic: optStr(fd, "cnic"),
      address: optStr(fd, "address"),
      area: optStr(fd, "area"),
      panel,
      packageName,
      monthlyFee,
      installDate: optDate(fd, "installDate"),
      notes: optStr(fd, "notes"),
      status: CustomerStatus.OVERDUE, // no payment yet
    },
  });

  redirect(`/customers/${customer.id}`);
}

export async function updateCustomer(_prev: unknown, fd: FormData) {
  const id = str(fd, "id");
  if (!id) return { error: "Missing customer id." };

  const monthlyFee = parseInt(str(fd, "monthlyFee") || "0", 10);
  if (!Number.isFinite(monthlyFee) || monthlyFee < 0)
    return { error: "Monthly fee must be a valid number." };

  await db.customer.update({
    where: { id },
    data: {
      fullName: str(fd, "fullName"),
      phone: optStr(fd, "phone"),
      cnic: optStr(fd, "cnic"),
      address: optStr(fd, "address"),
      area: optStr(fd, "area"),
      panel: str(fd, "panel"),
      packageName: str(fd, "packageName"),
      monthlyFee,
      installDate: optDate(fd, "installDate"),
      notes: optStr(fd, "notes"),
    },
  });

  revalidatePath(`/customers/${id}`);
  return { ok: true };
}

export async function setStatus(_prev: unknown, fd: FormData) {
  const id = str(fd, "id");
  const status = str(fd, "status") as CustomerStatus;
  if (!id || !status) return { error: "Missing data." };
  await db.customer.update({ where: { id }, data: { status } });
  revalidatePath(`/customers/${id}`);
  return { ok: true };
}

export async function recordPayment(_prev: unknown, fd: FormData) {
  const session = await getSession();
  const customerId = str(fd, "customerId");
  const amount = parseInt(str(fd, "amount") || "0", 10);
  const monthsCovered = parseInt(str(fd, "monthsCovered") || "1", 10);
  const method = (str(fd, "method") || "CASH") as PaymentMethod;
  const note = optStr(fd, "note");
  const paidOn = optDate(fd, "paidOn") ?? new Date();

  if (!customerId) return { error: "Missing customer." };
  if (!Number.isFinite(amount) || amount <= 0)
    return { error: "Amount must be greater than 0." };
  if (!Number.isFinite(monthsCovered) || monthsCovered < 1)
    return { error: "Months covered must be at least 1." };

  const customer = await db.customer.findUnique({ where: { id: customerId } });
  if (!customer) return { error: "Customer not found." };

  const newPaidUntil = extendPaidUntil(customer.paidUntil, monthsCovered, paidOn);
  const newStatus = computeStatus(newPaidUntil);

  await db.$transaction([
    db.payment.create({
      data: {
        customerId,
        amount,
        method,
        monthsCovered,
        paidOn,
        note,
        recordedById: session?.staffId ?? null,
      },
    }),
    db.customer.update({
      where: { id: customerId },
      data: { paidUntil: newPaidUntil, status: newStatus },
    }),
  ]);

  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/");
  return { ok: true };
}
