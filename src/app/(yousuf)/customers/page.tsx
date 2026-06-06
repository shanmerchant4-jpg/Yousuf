import type { Metadata } from "next";
import Link from "next/link";
import { Prisma, CustomerStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { formatPKR, fmtDate } from "@/lib/billing";
import { StatusBadge } from "@/components/StatusBadge";

export const metadata: Metadata = {
  title: "Customers — ISP Billing",
};

export const dynamic = "force-dynamic";

const STATUSES: CustomerStatus[] = ["ACTIVE", "OVERDUE", "SUSPENDED", "DISCONNECTED"];
const PAGE_SIZE = 50;

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; panel?: string; page?: string }>;
}) {
  const { q, status, panel, page: pageParam } = await searchParams;

  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const skip = (page - 1) * PAGE_SIZE;

  const where: Prisma.CustomerWhereInput = {};
  if (q) {
    where.OR = [
      { fullName: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
      { cnic: { contains: q } },
      { area: { contains: q, mode: "insensitive" } },
      { address: { contains: q, mode: "insensitive" } },
      { notes: { contains: q, mode: "insensitive" } },
    ];
  }
  if (status && STATUSES.includes(status as CustomerStatus))
    where.status = status as CustomerStatus;
  if (panel) where.panel = panel;

  const [customers, total, panels] = await Promise.all([
    db.customer.findMany({
      where,
      orderBy: { fullName: "asc" },
      skip,
      take: PAGE_SIZE,
    }),
    db.customer.count({ where }),
    db.customer.findMany({
      distinct: ["panel"],
      select: { panel: true },
      orderBy: { panel: "asc" },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function pageUrl(p: number): string {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    if (panel) params.set("panel", panel);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return `/customers${qs ? `?${qs}` : ""}`;
  }

  const hasFilters = !!(q || status || panel);

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-100">Customers</h1>
        <div className="flex items-center gap-2">
          <Link href="/customers/import" className="btn-ghost">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Import CSV
          </Link>
          <Link href="/customers/new" className="btn-primary">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add customer
          </Link>
        </div>
      </div>

      {/* Filters */}
      <form className="card" method="get" role="search" aria-label="Filter customers">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-48 flex-1">
            <label className="label" htmlFor="q">Search</label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3" aria-hidden="true">
                <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803 7.5 7.5 0 0016.803 15.803z" />
                </svg>
              </div>
              <input
                id="q"
                name="q"
                defaultValue={q ?? ""}
                placeholder="Name, phone, CNIC, area, address, logon ID…"
                className="input pl-9"
                aria-label="Search customers"
              />
            </div>
          </div>
          <div className="w-36">
            <label className="label" htmlFor="status-filter">Status</label>
            <select id="status-filter" name="status" defaultValue={status ?? ""} className="input">
              <option value="">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>
              ))}
            </select>
          </div>
          <div className="w-32">
            <label className="label" htmlFor="panel-filter">Panel</label>
            <select id="panel-filter" name="panel" defaultValue={panel ?? ""} className="input">
              <option value="">All panels</option>
              {panels.map((p) => (
                <option key={p.panel} value={p.panel}>{p.panel}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary">Filter</button>
            {hasFilters && (
              <Link href="/customers" className="btn-ghost">Reset</Link>
            )}
          </div>
        </div>
      </form>

      {/* Table */}
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-left text-sm" aria-label="Customer list">
          <thead className="border-b border-surface-border bg-white/5">
            <tr>
              <th scope="col" className="table-header-cell">Name</th>
              <th scope="col" className="table-header-cell">Phone</th>
              <th scope="col" className="table-header-cell hidden sm:table-cell">Panel</th>
              <th scope="col" className="table-header-cell hidden md:table-cell">Package</th>
              <th scope="col" className="table-header-cell hidden md:table-cell">Fee</th>
              <th scope="col" className="table-header-cell">Paid until</th>
              <th scope="col" className="table-header-cell">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {customers.map((c, i) => (
              <tr
                key={c.id}
                className={[
                  "transition-colors hover:bg-white/5",
                  i % 2 === 1 ? "bg-white/[0.03]" : "",
                ].join(" ")}
              >
                <td className="table-cell font-medium">
                  <Link
                    href={`/customers/${c.id}`}
                    className="text-slate-100 hover:text-brand-400 focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                  >
                    {c.fullName}
                  </Link>
                </td>
                <td className="table-cell text-slate-500">{c.phone ?? "—"}</td>
                <td className="table-cell hidden text-slate-500 sm:table-cell">{c.panel}</td>
                <td className="table-cell hidden text-slate-500 md:table-cell">{c.packageName}</td>
                <td className="table-cell hidden text-slate-500 md:table-cell">{formatPKR(c.monthlyFee)}</td>
                <td className="table-cell text-slate-500">{fmtDate(c.paidUntil)}</td>
                <td className="table-cell"><StatusBadge status={c.status} /></td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-16 text-center">
                  <div className="mx-auto flex max-w-xs flex-col items-center">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
                      <svg className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-slate-300">No customers found</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {hasFilters ? "Try adjusting your filters." : "Add your first customer to get started."}
                    </p>
                    {!hasFilters && (
                      <Link href="/customers/new" className="btn-primary mt-4 text-xs">
                        Add customer
                      </Link>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-slate-400">
        <span>
          {total === 0
            ? "No customers."
            : `Showing ${skip + 1}–${Math.min(skip + PAGE_SIZE, total)} of ${total}`}
        </span>
        {totalPages > 1 && (
          <nav className="flex items-center gap-1" aria-label="Pagination">
            {page > 1 ? (
              <Link href={pageUrl(page - 1)} className="btn-ghost px-3 py-1.5 text-xs" aria-label="Previous page">
                ← Prev
              </Link>
            ) : (
              <span className="btn-ghost cursor-default px-3 py-1.5 text-xs opacity-40" aria-disabled="true">
                ← Prev
              </span>
            )}
            <span className="px-3 text-xs tabular-nums">
              {page} / {totalPages}
            </span>
            {page < totalPages ? (
              <Link href={pageUrl(page + 1)} className="btn-ghost px-3 py-1.5 text-xs" aria-label="Next page">
                Next →
              </Link>
            ) : (
              <span className="btn-ghost cursor-default px-3 py-1.5 text-xs opacity-40" aria-disabled="true">
                Next →
              </span>
            )}
          </nav>
        )}
      </div>
    </div>
  );
}
