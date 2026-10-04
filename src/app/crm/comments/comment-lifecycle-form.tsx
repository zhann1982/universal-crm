"use client";

import { OrganizationForm } from "@/modules/access/organization-context";
import { useToastActionState } from "@/modules/notifications/use-toast-action-state";
import type { CommentActionState } from "@/lib/validation/comment";

export function CommentLifecycleForm({ action, commentId, version, label }: {
  action: (form: FormData) => Promise<CommentActionState>; commentId: string; version: number; label: string;
}) {
  const [state, submit, pending] = useToastActionState(async (_previous: CommentActionState, form: FormData) => action(form), {});
  return <OrganizationForm action={submit}>
    <input type="hidden" name="commentId" value={commentId} />
    <input type="hidden" name="version" value={version} />
    <button type="submit" disabled={pending} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 disabled:opacity-50">{pending ? "Сохранение…" : label}</button>
    {state.message && !state.success && <p role="alert" className="mt-2 text-sm text-red-700">{state.message}</p>}
  </OrganizationForm>;
}
