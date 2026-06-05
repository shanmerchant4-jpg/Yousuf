import type { Metadata } from "next";
import Link from "next/link";
import { CustomerStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { formatPKR, fmtDate } from "@/lib/billing";
import { StatusBadge } from "@/components/StatusBadge";
import { WorklistButton } from "./WorklistButton";
import { markPanelDisabled, markPanelReenabled } from "./actions";

export const metadata: Metadata = {
  title: "Action list — ISP Billing",
};

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  fullName: string;
  phone: string | null;
  paidUntil: Date | null;
  monthlyFee: number;
  status: CustomerStatus;
};

function WorklistTable({
  rows,
  action,
  buttonLabel,
}: {
  rows: Row[];
  action: (prev: unknown, fd: FormData) => Promise<{ error?: string; ok?: boolean } | null>;
  buttonLabel: string;
}) {
  return (
    <div className="card overflow-x-auto p-0">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-surface-border bg-white/5">
          <tr>
            <th scope="col" className="table-header-cell">Name</th>
            <th scope="col" className="table-header-cell">Phone</th>
            <th scope="col" className="table-header-cell">Paid until</th>
            <th scope="col" className="table-header-cell hidden md:table-cell">Fee</th>
            <th scope="col" className="table-header-cell">Status</th>
            <th scope="col" className="table-header-cell text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {rows.map((c, i) => (
            <tr key={c.id} className={i % 2 === 1 ? "bg-white/[0.03]" : ""}>
              <td className="table-cell font-medium">
                <Link
                  href={`/customers/${c.id}`}
                  className="text-slate-100 hover:text-brand-400"
                >
                  {c.fullName}
                </Link>
              </td>
              <td className="table-cell text-slate-500">{c.phone ?? "—"}</td>
              <td className="table-cell text-slate-500">{fmtDate(c.paidUntil)}</td>
              <td className="table-cell hidden text-slate-500 md:table-cell">{formatPKR(c.monthlyFee)}</td>
              <td className="table-cell"><StatusBadge status={c.status} /></td>
              <td className="table-cell text-right">
                <WorklistButton action={action} id={c.id} label={buttonLabel} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function ActionsPage() {
  const select = {
    id: true,
    fullName: true,
    phone: true,
    paidUntil: true,
    monthlyFee: true,
    status: true,
  };

  const [toDisable, toReenable] = await Promise.all([
    db.customer.findMany({
      where: { status: CustomerStatus.SUSPENDED, panelDisabledAt: null },
      orderBy: { fullName: "asc" },
      select,
    }),
    db.customer.findMany({
      where: { status: CustomerStatus.ACTIVE, panelDisabledAt: { not: null } },
      orderBy: { fullName: "asc" },
      select,
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Action list</h1>
        <p className="mt-1 text-sm text-slate-400">
          Internet is cut/restored in the Jazz panel. This list tells you who to disable or re-enable there.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="font-semibold text-slate-100">
          To disable in panel <span className="text-slate-400">({toDisable.length})</span>
        </h2>
        {toDisable.length === 0 ? (
          <div className="card text-sm text-slate-500">Nobody to disable right now.</div>
        ) : (
          <WorklistTable
            rows={toDisable}
            action={markPanelDisabled}
            buttonLabel="Mark disabled in panel"
          />
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-slate-100">
          To re-enable in panel <span className="text-slate-400">({toReenable.length})</span>
        </h2>
        {toReenable.length === 0 ? (
          <div className="card text-sm text-slate-500">Nobody to re-enable right now.</div>
        ) : (
          <WorklistTable
            rows={toReenable}
            action={markPanelReenabled}
            buttonLabel="Mark re-enabled"
          />
        )}
      </section>
    </div>
  );
}
