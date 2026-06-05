import Link from "next/link";
import { Prisma, CustomerStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { formatPKR, fmtDate } from "@/lib/billing";
import { StatusBadge } from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

const STATUSES: CustomerStatus[] = ["ACTIVE", "OVERDUE", "SUSPENDED", "DISCONNECTED"];

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; panel?: string }>;
}) {
  const { q, status, panel } = await searchParams;

  const where: Prisma.CustomerWhereInput = {};
  if (q) {
    where.OR = [
      { fullName: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
      { cnic: { contains: q } },
      { area: { contains: q, mode: "insensitive" } },
    ];
  }
  if (status && STATUSES.includes(status as CustomerStatus))
    where.status = status as CustomerStatus;
  if (panel) where.panel = panel;

  const [customers, panels] = await Promise.all([
    db.customer.findMany({ where, orderBy: { fullName: "asc" }, take: 500 }),
    db.customer.findMany({ distinct: ["panel"], select: { panel: true }, orderBy: { panel: "asc" } }),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Customers</h1>
        <Link href="/customers/new" className="btn-primary">+ Add customer</Link>
      </div>

      <form className="card flex flex-wrap items-end gap-3" method="get">
        <div className="min-w-48 flex-1">
          <label className="label">Search</label>
          <input name="q" defaultValue={q ?? ""} placeholder="Name, phone, CNIC, area…" className="input" />
        </div>
        <div>
          <label className="label">Status</label>
          <select name="status" defaultValue={status ?? ""} className="input">
            <option value="">All</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Panel</label>
          <select name="panel" defaultValue={panel ?? ""} className="input">
            <option value="">All</option>
            {panels.map((p) => (
              <option key={p.panel} value={p.panel}>{p.panel}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-primary">Filter</button>
        <Link href="/customers" className="btn-ghost">Reset</Link>
      </form>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Panel</th>
              <th className="px-4 py-3">Package</th>
              <th className="px-4 py-3">Fee</th>
              <th className="px-4 py-3">Paid until</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {customers.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium">
                  <Link href={`/customers/${c.id}`} className="hover:text-brand-600">{c.fullName}</Link>
                </td>
                <td className="px-4 py-3 text-slate-600">{c.phone ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">{c.panel}</td>
                <td className="px-4 py-3 text-slate-600">{c.packageName}</td>
                <td className="px-4 py-3 text-slate-600">{formatPKR(c.monthlyFee)}</td>
                <td className="px-4 py-3 text-slate-600">{fmtDate(c.paidUntil)}</td>
                <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                  No customers found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400">Showing up to 500 results. Narrow with search/filters.</p>
    </div>
  );
}
