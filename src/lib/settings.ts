import { db } from "@/lib/db";
import { GRACE_DAYS } from "@/lib/billing";

const SETTINGS_ID = "singleton";

/**
 * Read the configurable grace days from the Settings singleton row,
 * creating it with defaults if missing. Falls back to the env-derived
 * GRACE_DAYS (default 3) if the row can't be read.
 */
export async function getGraceDays(): Promise<number> {
  try {
    const settings = await db.settings.upsert({
      where: { id: SETTINGS_ID },
      update: {},
      create: { id: SETTINGS_ID, graceDays: GRACE_DAYS },
      select: { graceDays: true },
    });
    return settings.graceDays;
  } catch {
    return GRACE_DAYS;
  }
}
