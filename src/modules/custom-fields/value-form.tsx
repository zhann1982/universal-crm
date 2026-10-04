"use client";
import { useState } from "react";
import { OrganizationForm } from "@/modules/access/organization-context";
import { useToastActionState } from "@/modules/notifications/use-toast-action-state";
import { updateFieldValues } from "./actions";
import { CustomFieldInputs } from "./inputs";
import type { FieldDefinition, FieldEntity } from "./validation";
export function CustomValueForm(props: {
  entity: FieldEntity;
  id: string;
  version: number;
  revision: number;
  fields: FieldDefinition[];
  values: Record<string, string>;
}) {
  // Refreshed props must not promote the version of an existing draft.
  const [draft] = useState(props);
  const [state, action, pending] = useToastActionState(
    async (previous, form: FormData) => {
      const next = await updateFieldValues(previous, form);
      return {
        ...next,
        savedVersion: next.savedVersion ?? previous.savedVersion,
      };
    },
    {} as import("./actions").FieldState,
  );
  return (
    <OrganizationForm action={action} className="mt-4 space-y-3">
      <input type="hidden" name="entity" value={draft.entity} />
      <input type="hidden" name="id" value={draft.id} />
      <input
        type="hidden"
        name="version"
        value={state.savedVersion ?? draft.version}
      />
      <CustomFieldInputs
        fields={draft.fields}
        revision={draft.revision}
        values={draft.values}
      />
      {state.message && (
        <p
          role="status"
          className={state.success ? "text-green-700" : "text-red-700"}
        >
          {state.message}
        </p>
      )}
      <button
        disabled={pending}
        className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {pending ? "Сохранение…" : "Сохранить поля"}
      </button>
    </OrganizationForm>
  );
}
