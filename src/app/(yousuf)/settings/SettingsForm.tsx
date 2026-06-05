"use client";

import { useActionState } from "react";

type Result = { error?: string; ok?: boolean } | null;
type Action = (prev: unknown, fd: FormData) => Promise<Result>;

export function SettingsForm({
  action,
  graceDays,
}: {
  action: Action;
  graceDays: number;
}) {
  const [state, formAction, pending] = useActionState(action, null as Result);

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <label className="label" htmlFor="graceDays">Grace days</label>
        <input
          id="graceDays"
          name="graceDays"
          type="number"
          min="0"
          max="30"
          defaultValue={graceDays}
          className="input"
          required
        />
        <p className="mt-1.5 text-xs text-slate-400">
          Days after due date before a customer should be cut.
        </p>
      </div>

      {state?.error && <p className="text-sm text-red-400">{state.error}</p>}
      {state?.ok && <p className="text-sm text-emerald-400">Saved.</p>}

      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}
