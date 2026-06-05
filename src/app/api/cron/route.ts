import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { CustomerStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { computeStatus } from "@/lib/billing";

export const dynamic = "force-dynamic";

const BATCH_SIZE = 50;

/**
 * Daily job: recompute every customer's status from their paidUntil date.
 * Vercel Cron calls this with header `Authorization: Bearer <CRON_SECRET>`.
 * DISCONNECTED customers are left alone (manual/sticky state).
 * Updates are processed in batches of BATCH_SIZE to avoid exhausting the
 * Supabase connection pooler with unbounded concurrent queries.
 *
 * Auth is FAIL CLOSED: if CRON_SECRET is not set in the environment the
 * endpoint always returns 401 and never runs the job.
 */
async function run(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  // Fail closed: no secret configured means the endpoint is locked.
  if (!secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const auth = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  // Constant-time comparison using fixed-length UTF-8 buffers.
  // Comparing Buffers of the same encoding-derived length avoids short-circuit
  // leaks from !== and handles arbitrary-length secrets safely.
  const authBuf = Buffer.from(auth, "utf8");
  const expectedBuf = Buffer.from(expected, "utf8");
  const authorized =
    authBuf.length === expectedBuf.length &&
    timingSafeEqual(authBuf, expectedBuf);
  if (!authorized) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let customers: { id: string; status: CustomerStatus; paidUntil: Date | null }[];
  try {
    customers = await db.customer.findMany({
      where: { status: { not: CustomerStatus.DISCONNECTED } },
      select: { id: true, status: true, paidUntil: true },
    });
  } catch (e) {
    console.error("[cron] fetchCustomers", e);
    return NextResponse.json({ error: "Failed to fetch customers." }, { status: 500 });
  }

  const now = new Date();
  const toUpdate: { id: string; next: CustomerStatus }[] = [];

  for (const c of customers) {
    const next = computeStatus(c.paidUntil, now);
    if (next !== c.status) {
      toUpdate.push({ id: c.id, next });
    }
  }

  // Process in chunks to avoid overwhelming the connection pool
  let changed = 0;
  for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
    const chunk = toUpdate.slice(i, i + BATCH_SIZE);
    try {
      await Promise.all(
        chunk.map((item) =>
          db.customer.update({ where: { id: item.id }, data: { status: item.next } }),
        ),
      );
      changed += chunk.length;
    } catch (e) {
      console.error(`[cron] batch update failed (offset ${i})`, e);
      // Continue with remaining batches; partial success is better than none
    }
  }

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
