"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

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
