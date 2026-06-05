"use client";

import { useActionState } from "react";

type Result = { error?: string; ok?: boolean } | null;
type Action = (prev: unknown, fd: FormData) => Promise<Result>;

export function WorklistButton({
  action,
  id,
  label,
}: {
  action: Action;
  id: string;
  label: string;
}) {
  const [state, formAction, pending] = useActionState(action, null as Result);

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="btn-ghost px-3 py-1.5 text-xs" disabled={pending}>
        {pending ? "Saving…" : label}
      </button>
      {state?.error && <span className="text-xs text-red-400">{state.error}</span>}
    </form>
  );
}
