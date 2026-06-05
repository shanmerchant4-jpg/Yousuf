import type { Metadata } from "next";
import Link from "next/link";
import { CustomerStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { formatPKR, fmtDate, startOfDay } from "@/lib/billing";
import { StatusBadge } from "@/components/StatusBadge";

export const metadata: Metadata = {
  title: "Dashboard — ISP Billing",
};

export const dynamic = "force-dynamic";

function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

const cardDefs = [
  {
    key: "total" as const,
    label: "Total Customers",
    tone: "text-slate-900",
    accent: "bg-brand-500",
    iconPath:
      "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
  },
  {
    key: "ACTIVE" as const,
    label: "Active",
    tone: "text-emerald-700",
    accent: "bg-emerald-500",
    iconPath:
      "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  {
    key: "OVERDUE" as const,
    label: "Overdue",
    tone: "text-amber-700",
    accent: "bg-amber-500",
    iconPath:
      "M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  {
    key: "SUSPENDED" as const,
    label: "Suspended",
    tone: "text-red-700",
    accent: "bg-red-500",
    iconPath:
      "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636",
  },
];

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

  const statValues: Record<string, number> = {
    total,
    ACTIVE: countOf("ACTIVE"),
    OVERDUE: countOf("OVERDUE"),
    SUSPENDED: countOf("SUSPENDED"),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="hidden text-sm text-slate-500 sm:block">
          {now.toLocaleDateString("en-PK", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cardDefs.map((c) => (
          <div key={c.key} className="stat-card">
            {/* Accent top bar */}
            <div className={`absolute inset-x-0 top-0 h-1 rounded-t-xl ${c.accent}`} aria-hidden="true" />
            <div className="flex items-start justify-between pt-1">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {c.label}
                </p>
                <p className={`mt-2 text-3xl font-bold tabular-nums ${c.tone}`}>
                  {statValues[c.key]}
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 p-2 text-slate-400">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d={c.iconPath} />
                </svg>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Collections + due-soon */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Collected this month */}
        <div className="stat-card">
          <div className="absolute inset-x-0 top-0 h-1 rounded-t-xl bg-brand-600" aria-hidden="true" />
          <div className="pt-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Collected this month
            </p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-brand-600">
              {formatPKR(monthAgg._sum.amount ?? 0)}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {now.toLocaleDateString("en-PK", { month: "long", year: "numeric" })}
            </p>
          </div>
        </div>

        {/* Due soon */}
        <div className="card lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Due in next 7 days</h2>
            <Link
              href="/customers?status=OVERDUE"
              className="text-xs font-medium text-brand-600 hover:text-brand-700 hover:underline"
            >
              View all overdue
            </Link>
          </div>

          {dueSoon.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
                <svg className="h-6 w-6 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-slate-700">All clear!</p>
              <p className="mt-0.5 text-xs text-slate-400">Nobody due this week.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100" role="list">
              {dueSoon.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <Link
                    href={`/customers/${c.id}`}
                    className="truncate text-sm font-medium text-slate-800 hover:text-brand-600"
                  >
                    {c.fullName}
                  </Link>
                  <span className="flex flex-shrink-0 items-center gap-2.5">
                    <span className="text-xs text-slate-400">{fmtDate(c.paidUntil)}</span>
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
