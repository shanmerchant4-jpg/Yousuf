"use client";

import { useActionState } from "react";
import type { ImportResult } from "./actions";

type Action = (prev: unknown, fd: FormData) => Promise<ImportResult>;

export function ImportForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, null as ImportResult | null);

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <label className="label" htmlFor="csvFile">Upload .csv file</label>
        <input id="csvFile" name="csvFile" type="file" accept=".csv,text/csv" className="input" />
      </div>

      <div className="text-center text-xs font-medium uppercase tracking-wide text-slate-400">or</div>

      <div>
        <label className="label" htmlFor="csvText">Paste CSV text</label>
        <textarea
          id="csvText"
          name="csvText"
          rows={10}
          className="input font-mono text-xs"
          placeholder="fullName,phone,cnic,address,area,panel,packageName,monthlyFee,paidUntil,notes"
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
