import { NextRequest, NextResponse } from "next/server";
import { CustomerStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { computeStatus } from "@/lib/billing";

export const dynamic = "force-dynamic";

/**
 * Daily job: recompute every customer's status from their paidUntil date.
 * Vercel Cron calls this with header `Authorization: Bearer <CRON_SECRET>`.
 * DISCONNECTED customers are left alone (manual/sticky state).
 */
async function run(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const customers = await db.customer.findMany({
    where: { status: { not: CustomerStatus.DISCONNECTED } },
    select: { id: true, status: true, paidUntil: true },
  });

  const now = new Date();
  let changed = 0;
  const updates: Promise<unknown>[] = [];

  for (const c of customers) {
    const next = computeStatus(c.paidUntil, now);
    if (next !== c.status) {
      changed++;
      updates.push(
        db.customer.update({ where: { id: c.id }, data: { status: next } }),
      );
    }
  }
  await Promise.all(updates);

  return NextResponse.json({
    ok: true,
    checked: customers.length,
    changed,
    ranAt: now.toISOString(),
  });
}

export async function GET(req: NextRequest) {
  return run(req);
}
export async function POST(req: NextRequest) {
  return run(req);
}
