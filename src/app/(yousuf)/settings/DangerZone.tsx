"use client";

import { useActionState } from "react";
import { wipeAllCustomers, refreshAllStatuses } from "./actions";

type Result = { error?: string; ok?: boolean; message?: string } | null;

export function DangerZone() {
  const [refState, refAction, refreshing] = useActionState(refreshAllStatuses, null as Result);
  const [wipeState, wipeAction, wiping] = useActionState(wipeAllCustomers, null as Result);

  return (
    <div className="space-y-5">
      {/* Refresh statuses (auto overdue/suspended sweep) */}
      <div className="card">
        <h2 className="font-semibold text-slate-100">Update overdue statuses</h2>
        <p className="mb-3 mt-1 text-xs text-slate-400 leading-relaxed">
          Recompute every customer&apos;s status from their paid-until date and the grace window
          (Active &rarr; Overdue &rarr; Suspended). The nightly job does this automatically; use
          this to run it right now.
        </p>
        <form action={refAction}>
          <button type="submit" className="btn-primary" disabled={refreshing}>
            {refreshing ? "Updating…" : "Refresh statuses now"}
          </button>
        </form>
        {refState?.error && <p className="mt-2 text-sm text-red-400">{refState.error}</p>}
        {refState?.ok && <p className="mt-2 text-sm text-emerald-400">{refState.message ?? "Done."}</p>}
      </div>

      {/* Wipe database */}
      <div className="card border border-red-500/30">
        <h2 className="font-semibold text-red-300">Danger zone — wipe all customers</h2>
        <p className="mb-3 mt-1 text-xs text-slate-400 leading-relaxed">
          Permanently deletes <strong>every customer and all their payments</strong>. Your login
          and settings stay. This cannot be undone.
        </p>
        <form
          action={wipeAction}
          onSubmit={(e) => {
            if (!window.confirm("Delete ALL customers and their payments? This cannot be undone.")) {
              e.preventDefault();
            }
          }}
          className="flex flex-wrap items-end gap-2"
        >
          <div>
            <label className="label" htmlFor="confirm">Type WIPE to confirm</label>
            <input id="confirm" name="confirm" className="input" placeholder="WIPE" autoComplete="off" />
          </div>
          <button type="submit" className="btn-danger" disabled={wiping}>
            {wiping ? "Wiping…" : "Wipe database"}
          </button>
        </form>
        {wipeState?.error && <p className="mt-2 text-sm text-red-400">{wipeState.error}</p>}
        {wipeState?.ok && <p className="mt-2 text-sm text-emerald-400">{wipeState.message ?? "Wiped."}</p>}
      </div>
    </div>
  );
}
