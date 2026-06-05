import Link from "next/link";
import { CustomerStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { formatPKR, fmtDate, startOfDay } from "@/lib/billing";
import { StatusBadge } from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export default async function Dashboard() {
  const now = new Date();
  const weekAhead = new Date(now);
  weekAhead.setDate(weekAhead.getDate() + 7);

  const [counts, monthAgg, dueSoon] = await Promise.all([
    db.customer.groupBy({ by: ["status"], _count: true }),
    db.payment.aggregate({
      _sum: { amount: true },
      where: { paidOn: { gte: startOfMonth(now) } },
    }),
    db.customer.findMany({
      where: {
        status: { in: [CustomerStatus.ACTIVE, CustomerStatus.OVERDUE] },
        paidUntil: { gte: startOfDay(now), lte: weekAhead },
      },
      orderBy: { paidUntil: "asc" },
      take: 15,
    }),
  ]);

  const countOf = (s: CustomerStatus) =>
    counts.find((c) => c.status === s)?._count ?? 0;
  const total = counts.reduce((a, c) => a + (c._count as number), 0);

  const cards = [
    { label: "Total customers", value: total, tone: "text-slate-900" },
    { label: "Active", value: countOf("ACTIVE"), tone: "text-green-600" },
    { label: "Overdue", value: countOf("OVERDUE"), tone: "text-amber-600" },
    { label: "Suspended", value: countOf("SUSPENDED"), tone: "text-red-600" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="card">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {c.label}
            </div>
            <div className={`mt-2 text-3xl font-bold ${c.tone}`}>{c.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card lg:col-span-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Collected this month
          </div>
          <div className="mt-2 text-3xl font-bold text-brand-600">
            {formatPKR(monthAgg._sum.amount ?? 0)}
          </div>
        </div>

        <div className="card lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Due in next 7 days</h2>
            <Link href="/customers?status=OVERDUE" className="text-sm text-brand-600 hover:underline">
              View overdue →
            </Link>
          </div>
          {dueSoon.length === 0 ? (
            <p className="text-sm text-slate-500">Nobody due this week. 🎉</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {dueSoon.map((c) => (
                <li key={c.id} className="flex items-center justify-between py-2 text-sm">
                  <Link href={`/customers/${c.id}`} className="font-medium text-slate-800 hover:text-brand-600">
                    {c.fullName}
                  </Link>
                  <span className="flex items-center gap-3 text-slate-500">
                    <span>{fmtDate(c.paidUntil)}</span>
                    <StatusBadge status={c.status} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
