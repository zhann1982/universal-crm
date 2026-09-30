"use client";

import { OrganizationForm } from "@/modules/access/organization-context";


import {
  useActionState,
} from "react";

import {
  createComment,
} from "./actions";
import type {
  CommentActionState,
} from "@/lib/validation/comment";
import type {
  ActivityEntityType,
} from "@/modules/activity/entity-types";

const initialState:
  CommentActionState = {};

export function CommentComposer({
  entityType,
  entityId,
}: {
  entityType:
    ActivityEntityType;
  entityId: string;
}) {
  const [
    state,
    formAction,
    pending,
  ] = useActionState(
    createComment,
    initialState,
  );

  return (
    <OrganizationForm
      action={formAction}
      className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4"
    >
      <input
        type="hidden"
        name="entityType"
        value={entityType}
      />
      <input
        type="hidden"
        name="entityId"
        value={entityId}
      />

      <label
        htmlFor={`comment-${entityType}-${entityId}`}
        className="text-sm font-medium text-slate-800"
      >
        Новый комментарий
      </label>

      <textarea
        key={
          state.revision ??
          "comment-new"
        }
        id={`comment-${entityType}-${entityId}`}
        name="body"
        rows={4}
        maxLength={4000}
        defaultValue={
          state.values?.body ?? ""
        }
        placeholder="Добавьте важную информацию, договорённость или заметку..."
        className="mt-2 w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-slate-500"
      />

      {state.errors?.body?.map(
        (error) => (
          <p
            key={error}
            className="mt-2 text-sm text-red-600"
          >
            {error}
          </p>
        ),
      )}

      {state.message && (
        <p
          className={
            state.success
              ? "mt-2 text-sm text-emerald-700"
              : "mt-2 text-sm text-red-700"
          }
        >
          {state.message}
        </p>
      )}

      <div className="mt-3 flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending
            ? "Добавление..."
            : "Добавить комментарий"}
        </button>
      </div>
    </OrganizationForm>
  );
}
