"use client";

import { useActionState } from "react";
import type { ImportResult } from "./actions";

type Action = (prev: unknown, fd: FormData) => Promise<ImportResult>;

export function ImportForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, null as ImportResult | null);

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <label className="label" htmlFor="csvFile">Upload file</label>
        <input
          id="csvFile"
          name="csvFile"
          type="file"
          accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          className="input"
        />
        <p className="mt-1 text-xs text-slate-400">Excel (.xlsx, .xls) or CSV — Himalaya Network format is auto-detected</p>
      </div>

      <div className="text-center text-xs font-medium uppercase tracking-wide text-slate-400">or</div>

      <div>
        <label className="label" htmlFor="csvText">Paste data</label>
        <textarea
          id="csvText"
          name="csvText"
          rows={10}
          className="input font-mono text-xs"
          placeholder={"fullName,phone,cnic,address,area,panel,packageName,monthlyFee,paidUntil,notes\nAli Hassan,03001234567,42201-1234567-1,Flat 3 Block B,,HC,15Mbps,1500,2026-07-01,"}
        />
      </div>

      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Importing…" : "Import customers"}
      </button>

      {state?.error && <p className="text-sm text-red-400">{state.error}</p>}

      {state && !state.error && (
        <div className="space-y-3 rounded-lg border border-surface-border bg-white/5 p-4">
          <p className="text-sm font-medium text-slate-100">
            Imported <span className="text-emerald-400">{state.imported ?? 0}</span>, skipped{" "}
            <span className="text-amber-300">{state.skipped ?? 0}</span>.
          </p>
          {state.errors && state.errors.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Errors (first {state.errors.length})
              </p>
              <ul className="space-y-0.5 text-xs text-red-400">
                {state.errors.map((msg, i) => (
                  <li key={i}>{msg}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </form>
  );
}
