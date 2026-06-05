"use client";

import { useActionState } from "react";

type Result = { error?: string; ok?: boolean } | null;
type Action = (prev: unknown, fd: FormData) => Promise<Result>;

export type CustomerDefaults = {
  id?: string;
  fullName?: string;
  phone?: string | null;
  cnic?: string | null;
  address?: string | null;
  area?: string | null;
  panel?: string;
  packageName?: string;
  monthlyFee?: number;
  installDate?: Date | null;
  notes?: string | null;
};

function dateValue(d?: Date | null): string {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

export function CustomerForm({
  action,
  defaults = {},
  submitLabel,
}: {
  action: Action;
  defaults?: CustomerDefaults;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, null as Result);

  return (
    <form action={formAction} className="space-y-5">
      {defaults.id && <input type="hidden" name="id" value={defaults.id} />}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="label">Full name *</label>
          <input name="fullName" defaultValue={defaults.fullName ?? ""} className="input" required />
        </div>
        <div>
          <label className="label">Phone</label>
          <input name="phone" defaultValue={defaults.phone ?? ""} className="input" />
        </div>
        <div>
          <label className="label">CNIC</label>
          <input name="cnic" defaultValue={defaults.cnic ?? ""} className="input" />
        </div>
        <div>
          <label className="label">Area / locality</label>
          <input name="area" defaultValue={defaults.area ?? ""} className="input" />
        </div>
        <div className="md:col-span-2">
          <label className="label">Address</label>
          <input name="address" defaultValue={defaults.address ?? ""} className="input" />
        </div>
        <div>
          <label className="label">Panel *</label>
          <input name="panel" defaultValue={defaults.panel ?? ""} placeholder="1 or 2" className="input" required />
        </div>
        <div>
          <label className="label">Package *</label>
          <input name="packageName" defaultValue={defaults.packageName ?? ""} placeholder="25 Mbps" className="input" required />
        </div>
        <div>
          <label className="label">Monthly fee (Rs) *</label>
          <input name="monthlyFee" type="number" min="0" defaultValue={defaults.monthlyFee ?? ""} className="input" required />
        </div>
        <div>
          <label className="label">Install date</label>
          <input name="installDate" type="date" defaultValue={dateValue(defaults.installDate)} className="input" />
        </div>
        <div className="md:col-span-2">
          <label className="label">Notes (type anything)</label>
          <textarea name="notes" defaultValue={defaults.notes ?? ""} rows={4} className="input" />
        </div>
      </div>

      {state?.error && <p className="text-sm text-red-400">{state.error}</p>}
      {state?.ok && <p className="text-sm text-emerald-400">Saved.</p>}

      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
