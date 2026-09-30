"use client";

import {
  useActionState,
} from "react";

import {
  updateComment,
} from "./actions";
import type {
  CommentActionState,
} from "@/lib/validation/comment";

const initialState:
  CommentActionState = {};

export function CommentEditor({
  commentId,
  version,
  body,
}: {
  commentId: string;
  version: number;
  body: string;
}) {
  const [
    state,
    formAction,
    pending,
  ] = useActionState(
    updateComment,
    initialState,
  );

  return (
    <details className="mt-3">
      <summary className="cursor-pointer text-xs font-medium text-slate-600 hover:text-slate-950">
        Редактировать
      </summary>

      <form
        action={formAction}
        className="mt-3"
      >
        <input
          type="hidden"
          name="commentId"
          value={commentId}
        />
        <input
          type="hidden"
          name="version"
          value={version}
        />

        <textarea
          key={
            state.revision ??
            `${commentId}-${version}`
          }
          name="body"
          rows={4}
          maxLength={4000}
          defaultValue={
            state.values?.body ??
            body
          }
          className="w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-500"
        />

        {state.errors?.body?.map(
          (error) => (
            <p
              key={error}
              className="mt-2 text-xs text-red-600"
            >
              {error}
            </p>
          ),
        )}

        {state.message && (
          <p
            className={
              state.success
                ? "mt-2 text-xs text-emerald-700"
                : "mt-2 text-xs text-red-700"
            }
          >
            {state.message}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-3 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
        >
          {pending
            ? "Сохранение..."
            : "Сохранить изменения"}
        </button>
      </form>
    </details>
  );
}
