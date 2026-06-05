"use client";

import { useActionState, useRef, useEffect } from "react";
import { recordPayment } from "./actions";

type Result = { error?: string; ok?: boolean } | null;

export function PaymentForm({
  customerId,
  defaultAmount,
}: {
  customerId: string;
  defaultAmount: number;
}) {
  const [state, action, pending] = useActionState(recordPayment, null as Result);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <input type="hidden" name="customerId" value={customerId} />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Amount (Rs)</label>
          <input name="amount" type="number" min="1" defaultValue={defaultAmount || ""} className="input" required />
        </div>
        <div>
          <label className="label">Months covered</label>
          <input name="monthsCovered" type="number" min="1" defaultValue={1} className="input" required />
        </div>
        <div>
          <label className="label">Method</label>
          <select name="method" className="input" defaultValue="CASH">
            <option value="CASH">Cash</option>
            <option value="JAZZCASH">JazzCash</option>
            <option value="EASYPAISA">Easypaisa</option>
            <option value="BANK">Bank</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
        <div>
          <label className="label">Paid on</label>
          <input name="paidOn" type="date" className="input" />
        </div>
        <div className="col-span-2">
          <label className="label">Note (optional)</label>
          <input name="note" className="input" />
        </div>
      </div>

      {state?.error && <p className="text-sm text-red-400">{state.error}</p>}
      {state?.ok && <p className="text-sm text-emerald-400">Payment recorded. Status updated.</p>}

      <button type="submit" className="btn-primary w-full" disabled={pending}>
        {pending ? "Recording…" : "Record payment"}
      </button>
    </form>
  );
}
