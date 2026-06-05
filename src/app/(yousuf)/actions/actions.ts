"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

const IdSchema = z.object({ id: z.string().min(1, "Missing customer id.") });

export async function markPanelDisabled(_prev: unknown, fd: FormData) {
  const session = await getSession();
  if (!session) return { error: "Not authenticated." };

  const parsed = IdSchema.safeParse({ id: String(fd.get("id") ?? "").trim() });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  try {
    await db.customer.update({
      where: { id: parsed.data.id },
      data: { panelDisabledAt: new Date() },
    });
  } catch (e) {
    console.error("[markPanelDisabled]", e);
    return { error: "Failed to update. Please try again." };
  }

  revalidatePath("/actions");
  revalidatePath("/");
  return { ok: true };
}

export async function markPanelReenabled(_prev: unknown, fd: FormData) {
  const session = await getSession();
  if (!session) return { error: "Not authenticated." };

  const parsed = IdSchema.safeParse({ id: String(fd.get("id") ?? "").trim() });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  try {
    await db.customer.update({
      where: { id: parsed.data.id },
      data: { panelDisabledAt: null },
    });
  } catch (e) {
    console.error("[markPanelReenabled]", e);
    return { error: "Failed to update. Please try again." };
  }

  revalidatePath("/actions");
  revalidatePath("/");
  return { ok: true };
}
