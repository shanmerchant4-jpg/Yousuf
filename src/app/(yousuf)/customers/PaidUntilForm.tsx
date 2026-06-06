"use client";

import { useActionState } from "react";
import { setPaidUntil } from "./actions";

type Result = { error?: string; ok?: boolean } | null;

export function PaidUntilForm({
  id,
  current,
}: {
  id: string;
  current: string;
}) {
  const [state, action, pending] = useActionState(setPaidUntil, null as Result);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <div>
        <label className="label" htmlFor="paidUntil">Paid until</label>
        <input
          id="paidUntil"
          name="paidUntil"
          type="date"
          defaultValue={current}
          className="input"
        />
        <p className="mt-1.5 text-xs text-slate-400">
          Set the date service is paid through. Leave blank to clear.
        </p>
      </div>

      {state?.error && <p className="text-sm text-red-400">{state.error}</p>}
      {state?.ok && <p className="text-sm text-emerald-400">Saved. Status updated.</p>}

      <button type="submit" className="btn-ghost w-full" disabled={pending}>
        {pending ? "Saving…" : "Set paid-until"}
      </button>
    </form>
  );
}
