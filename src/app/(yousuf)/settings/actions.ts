"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { CustomerStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { computeStatus } from "@/lib/billing";
import { getGraceDays } from "@/lib/settings";

const SETTINGS_ID = "singleton";

const SettingsSchema = z.object({
  graceDays: z
    .number()
    .int("Grace days must be a whole number.")
    .min(0, "Grace days cannot be negative.")
    .max(30, "Grace days cannot exceed 30."),
});

export async function updateSettings(_prev: unknown, fd: FormData) {
  const session = await getSession();
  if (!session) return { error: "Not authenticated." };

  const parsed = SettingsSchema.safeParse({
    graceDays: parseInt(String(fd.get("graceDays") ?? "").trim() || "0", 10),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const { graceDays } = parsed.data;

  try {
    await db.settings.upsert({
      where: { id: SETTINGS_ID },
      update: { graceDays },
      create: { id: SETTINGS_ID, graceDays },
    });
  } catch (e) {
    console.error("[updateSettings]", e);
    return { error: "Failed to save settings. Please try again." };
  }

  revalidatePath("/settings");
  return { ok: true };
}


// ---------------------------------------------------------------------------
// Danger zone + status maintenance
// ---------------------------------------------------------------------------

/**
 * Recompute every customer's status from their paid-until date and the grace
 * window — the same logic the nightly cron runs. DISCONNECTED is left alone.
 * Lets the owner trigger the "auto overdue/suspended" sweep on demand.
 */
export async function refreshAllStatuses(_prev: unknown, _fd: FormData) {
  const session = await getSession();
  if (!session) return { error: "Not authenticated." };

  try {
    const graceDays = await getGraceDays();
    const now = new Date();
    const customers = await db.customer.findMany({
      where: { status: { not: CustomerStatus.DISCONNECTED } },
      select: { id: true, status: true, paidUntil: true },
    });
    const updates = customers
      .map((c) => ({ id: c.id, next: computeStatus(c.paidUntil, now, graceDays), cur: c.status }))
      .filter((u) => u.next !== u.cur);
    for (let i = 0; i < updates.length; i += 50) {
      await Promise.all(
        updates.slice(i, i + 50).map((u) =>
          db.customer.update({ where: { id: u.id }, data: { status: u.next } }),
        ),
      );
    }
    revalidatePath("/");
    revalidatePath("/customers");
    return { ok: true, message: `Updated ${updates.length} of ${customers.length} customers.` };
  } catch (e) {
    console.error("[refreshAllStatuses]", e);
    return { error: "Failed to refresh statuses. Please try again." };
  }
}

/**
 * Permanently delete EVERY customer (and their payments, via cascade).
 * Owner-only. Requires the user to type WIPE to confirm. Logins/settings stay.
 */
export async function wipeAllCustomers(_prev: unknown, fd: FormData) {
  const session = await getSession();
  if (!session) return { error: "Not authenticated." };
  if (session.role !== "OWNER") return { error: "Only the owner can wipe the database." };

  const confirm = String(fd.get("confirm") ?? "").trim();
  if (confirm !== "WIPE") return { error: 'Type WIPE (in capitals) to confirm.' };

  try {
    const res = await db.customer.deleteMany({});
    revalidatePath("/");
    revalidatePath("/customers");
    return { ok: true, message: `Deleted ${res.count} customers and all their payments.` };
  } catch (e) {
    console.error("[wipeAllCustomers]", e);
    return { error: "Failed to wipe the database. Please try again." };
  }
}
