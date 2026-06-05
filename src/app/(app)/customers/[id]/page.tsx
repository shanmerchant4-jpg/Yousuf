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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{customer.fullName}</h1>
          <StatusBadge status={customer.status} />
        </div>
        <Link href="/customers" className="btn-ghost">← All customers</Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: summary + edit */}
        <div className="space-y-6 lg:col-span-2">
          <div className="card grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
            <Info label="Paid until" value={fmtDate(customer.paidUntil)} />
            <Info label="Monthly fee" value={formatPKR(customer.monthlyFee)} />
            <Info label="Panel" value={customer.panel} />
            <Info label="Package" value={customer.packageName} />
            <Info label="Phone" value={customer.phone ?? "—"} />
            <Info label="Area" value={customer.area ?? "—"} />
            <Info label="Total paid" value={formatPKR(totalPaid)} />
            <Info label="Installed" value={fmtDate(customer.installDate)} />
          </div>

          <div className="card">
            <h2 className="mb-4 font-semibold">Edit details</h2>
            <CustomerForm
              action={updateCustomer}
              submitLabel="Save changes"
              defaults={customer}
            />
          </div>

          <div className="card overflow-x-auto p-0">
            <h2 className="px-5 pt-5 font-semibold">Payment history</h2>
            <table className="mt-3 w-full text-left text-sm">
              <thead className="border-y border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-2">Date</th>
                  <th className="px-5 py-2">Amount</th>
                  <th className="px-5 py-2">Method</th>
                  <th className="px-5 py-2">Months</th>
                  <th className="px-5 py-2">By</th>
                  <th className="px-5 py-2">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customer.payments.map((p) => (
                  <tr key={p.id}>
                    <td className="px-5 py-2">{fmtDate(p.paidOn)}</td>
                    <td className="px-5 py-2 font-medium">{formatPKR(p.amount)}</td>
                    <td className="px-5 py-2 text-slate-600">{p.method}</td>
                    <td className="px-5 py-2 text-slate-600">{p.monthsCovered}</td>
                    <td className="px-5 py-2 text-slate-600">{p.recordedBy?.name ?? "—"}</td>
                    <td className="px-5 py-2 text-slate-600">{p.note ?? "—"}</td>
                  </tr>
                ))}
                {customer.payments.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-slate-500">
                      No payments yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: record payment + status + notes */}
        <div className="space-y-6">
          <div className="card">
            <h2 className="mb-4 font-semibold">Record payment</h2>
            <PaymentForm customerId={customer.id} defaultAmount={customer.monthlyFee} />
          </div>

          <div className="card">
            <h2 className="mb-3 font-semibold">Service status</h2>
            <StatusControls id={customer.id} current={customer.status} />
            <p className="mt-3 text-xs text-slate-400">
              Status auto-updates from payments + the daily check. Override here only for
              manual disconnects / reconnects.
            </p>
          </div>

          {customer.notes && (
            <div className="card">
              <h2 className="mb-2 font-semibold">Notes</h2>
              <p className="whitespace-pre-wrap text-sm text-slate-700">{customer.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 font-medium text-slate-800">{value}</div>
    </div>
  );
}
