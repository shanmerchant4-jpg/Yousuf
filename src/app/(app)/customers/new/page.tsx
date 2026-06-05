import type { Metadata } from "next";
import Link from "next/link";
import { CustomerForm } from "../CustomerForm";
import { createCustomer } from "../actions";

export const metadata: Metadata = {
  title: "Add Customer — ISP Billing",
};

export default function NewCustomerPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Add customer</h1>
        <Link href="/customers" className="btn-ghost">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Back
        </Link>
      </div>
      <div className="card">
        <CustomerForm action={createCustomer} submitLabel="Create customer" />
      </div>
    </div>
  );
}
