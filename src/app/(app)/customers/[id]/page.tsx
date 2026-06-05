import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatPKR, fmtDate } from "@/lib/billing";
import { StatusBadge } from "@/components/StatusBadge";
import { CustomerForm } from "../CustomerForm";
import { PaymentForm } from "../PaymentForm";
import { StatusControls } from "../StatusControls";
import { updateCustomer } from "../actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const customer = await db.customer.findUnique({ where: { id }, select: { fullName: true } });
  return {
    title: customer ? `${customer.fullName} — ISP Billing` : "Customer — ISP Billing",
  };
}

export default async function CustomerDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = await db.customer.findUnique({
    where: { id },
    include: {
      payments: {
        orderBy: { paidOn: "desc" },
        include: { recordedBy: { select: { name: true } } },
      },
    },
  });
  if (!customer) notFound();

  const totalPaid = customer.payments.reduce((a, p) => a + p.amount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900">{customer.fullName}</h1>
          <StatusBadge status={customer.status} />
        </div>
        <Link href="/customers" className="btn-ghost">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          All customers
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left column */}
        <div className="space-y-6 lg:col-span-2">
          {/* Summary grid */}
          <div className="card">
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-4">
              <Info label="Paid until" value={fmtDate(customer.paidUntil)} />
              <Info label="Monthly fee" value={formatPKR(customer.monthlyFee)} highlight />
              <Info label="Panel" value={customer.panel} />
              <Info label="Package" value={customer.packageName} />
              <Info label="Phone" value={customer.phone ?? "—"} />
              <Info label="Area" value={customer.area ?? "—"} />
              <Info label="Total paid" value={formatPKR(totalPaid)} highlight />
              <Info label="Installed" value={fmtDate(customer.installDate)} />
            </div>
          </div>

          {/* Edit form */}
          <div className="card">
            <h2 className="mb-4 font-semibold text-slate-900">Edit details</h2>
            <CustomerForm
              action={updateCustomer}
              submitLabel="Save changes"
              defaults={customer}
            />
          </div>

          {/* Payment history */}
          <div className="card overflow-x-auto p-0">
            <div className="flex items-center justify-between px-5 py-4">
              <h2 className="font-semibold text-slate-900">Payment history</h2>
              {customer.payments.length > 0 && (
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                  {customer.payments.length}
                </span>
              )}
            </div>
            <table className="w-full text-left text-sm" aria-label="Payment history">
              <thead className="border-y border-slate-200 bg-slate-50">
                <tr>
                  <th scope="col" className="table-header-cell">Date</th>
                  <th scope="col" className="table-header-cell">Amount</th>
                  <th scope="col" className="table-header-cell hidden sm:table-cell">Method</th>
                  <th scope="col" className="table-header-cell hidden sm:table-cell">Months</th>
                  <th scope="col" className="table-header-cell hidden md:table-cell">By</th>
                  <th scope="col" className="table-header-cell hidden md:table-cell">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customer.payments.map((p) => (
                  <tr key={p.id} className="transition-colors hover:bg-slate-50/70">
                    <td className="table-cell">{fmtDate(p.paidOn)}</td>
                    <td className="table-cell font-semibold text-slate-900">{formatPKR(p.amount)}</td>
                    <td className="table-cell hidden text-slate-500 sm:table-cell">{p.method}</td>
                    <td className="table-cell hidden text-slate-500 sm:table-cell">{p.monthsCovered}</td>
                    <td className="table-cell hidden text-slate-500 md:table-cell">{p.recordedBy?.name ?? "—"}</td>
                    <td className="table-cell hidden text-slate-500 md:table-cell">{p.note ?? "—"}</td>
                  </tr>
                ))}
                {customer.payments.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center">
                      <div className="flex flex-col items-center">
                        <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
                          <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
                          </svg>
                        </div>
                        <p className="text-sm font-medium text-slate-600">No payments yet</p>
                        <p className="mt-0.5 text-xs text-slate-400">Record the first payment using the form.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Record payment */}
          <div className="card">
            <h2 className="mb-4 font-semibold text-slate-900">Record payment</h2>
            <PaymentForm customerId={customer.id} defaultAmount={customer.monthlyFee} />
          </div>

          {/* Service status */}
          <div className="card">
            <h2 className="mb-3 font-semibold text-slate-900">Service status</h2>
            <StatusControls id={customer.id} current={customer.status} />
            <p className="mt-3 text-xs text-slate-400 leading-relaxed">
              Status auto-updates from payments and the daily check. Override here only for
              manual disconnects or reconnects.
            </p>
          </div>

          {/* Notes */}
          {customer.notes && (
            <div className="card">
              <h2 className="mb-2 font-semibold text-slate-900">Notes</h2>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{customer.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Info({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={["mt-1 font-medium", highlight ? "text-brand-700" : "text-slate-800"].join(" ")}>
        {value}
      </dd>
    </div>
  );
}
