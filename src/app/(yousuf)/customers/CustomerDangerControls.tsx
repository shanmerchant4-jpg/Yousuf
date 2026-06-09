"use client";

import { useActionState } from "react";
import { deleteCustomer, clearCustomerPayments } from "./actions";

type Result = { error?: string; ok?: boolean } | null;

export function CustomerDangerControls({ id }: { id: string }) {
  const [clrState, clrAction, clearing] = useActionState(clearCustomerPayments, null as Result);
  const [delState, delAction, deleting] = useActionState(deleteCustomer, null as Result);

  return (
    <div className="space-y-3">
      {/* Remove payment data (keep customer) */}
      <form
        action={clrAction}
        onSubmit={(e) => {
          if (!window.confirm("Remove this customer's payment history and reset their paid-until? The customer record stays.")) {
            e.preventDefault();
          }
        }}
      >
        <input type="hidden" name="id" value={id} />
        <button type="submit" className="btn-ghost w-full" disabled={clearing}>
          {clearing ? "Removing…" : "Remove payment data"}
        </button>
      </form>
      {clrState?.error && <p className="text-sm text-red-400">{clrState.error}</p>}
      {clrState?.ok && <p className="text-sm text-emerald-400">Payment history cleared.</p>}

      {/* Delete customer entirely */}
      <form
        action={delAction}
        onSubmit={(e) => {
          if (!window.confirm("Permanently delete this customer and ALL their payments? This cannot be undone.")) {
            e.preventDefault();
          }
        }}
      >
        <input type="hidden" name="id" value={id} />
        <button type="submit" className="btn-danger w-full" disabled={deleting}>
          {deleting ? "Deleting…" : "Delete customer"}
        </button>
      </form>
      {delState?.error && <p className="text-sm text-red-400">{delState.error}</p>}
    </div>
  );
}
