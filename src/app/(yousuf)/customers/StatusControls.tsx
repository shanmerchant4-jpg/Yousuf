"use client";

import { useActionState } from "react";
import { CustomerStatus } from "@prisma/client";
import { setStatus } from "./actions";

type Result = { error?: string; ok?: boolean } | null;

export function StatusControls({
  id,
  current,
}: {
  id: string;
  current: CustomerStatus;
}) {
  const [state, action, pending] = useActionState(setStatus, null as Result);

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <select name="status" defaultValue={current} className="input flex-1">
        <option value="ACTIVE">ACTIVE</option>
        <option value="OVERDUE">OVERDUE</option>
        <option value="SUSPENDED">SUSPENDED</option>
        <option value="DISCONNECTED">DISCONNECTED</option>
      </select>
      <button type="submit" className="btn-ghost" disabled={pending}>
        {pending ? "…" : "Set"}
      </button>
      {state?.error && <span className="text-xs text-red-400">{state.error}</span>}
    </form>
  );
}
