import type { Metadata } from "next";
import Link from "next/link";
import { ImportForm } from "./ImportForm";
import { importCustomers } from "./actions";

export const metadata: Metadata = {
  title: "Import Customers — ISP Billing",
};

export default function ImportPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-100">Import customers</h1>
        <Link href="/customers" className="btn-ghost">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Back
        </Link>
      </div>

      <div className="card space-y-2 text-sm text-slate-300">
        <p className="font-medium text-slate-100">Supported formats</p>
        <p>
          <strong className="text-slate-200">Excel (.xlsx, .xls)</strong> — Upload directly.
          The Himalaya Network alternating-row format is detected automatically.
          Standard Excel files with column headers also work.
        </p>
        <p>
          <strong className="text-slate-200">CSV / pasted text</strong> — Required column:{" "}
          <code className="rounded bg-white/10 px-1 py-0.5 text-xs">fullName</code> (or{" "}
          <code className="rounded bg-white/10 px-1 py-0.5 text-xs">name</code>). Optional:{" "}
          <code className="rounded bg-white/10 px-1 py-0.5 text-xs">phone</code>,{" "}
          <code className="rounded bg-white/10 px-1 py-0.5 text-xs">cnic</code>,{" "}
          <code className="rounded bg-white/10 px-1 py-0.5 text-xs">address</code>,{" "}
          <code className="rounded bg-white/10 px-1 py-0.5 text-xs">panel</code>,{" "}
          <code className="rounded bg-white/10 px-1 py-0.5 text-xs">packageName</code>,{" "}
          <code className="rounded bg-white/10 px-1 py-0.5 text-xs">monthlyFee</code>,{" "}
          <code className="rounded bg-white/10 px-1 py-0.5 text-xs">paidUntil</code>{" "}
          (YYYY-MM-DD),{" "}
          <code className="rounded bg-white/10 px-1 py-0.5 text-xs">notes</code>.
        </p>
        <p className="text-xs text-slate-400">
          Column names are case-insensitive. Status is computed automatically from paidUntil. Duplicates are skipped.
        </p>
      </div>

      <div className="card">
        <ImportForm action={importCustomers} />
      </div>
    </div>
  );
}
