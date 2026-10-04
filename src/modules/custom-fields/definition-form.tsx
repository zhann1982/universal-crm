"use client";
import { useState } from "react";
import { OrganizationForm } from "@/modules/access/organization-context";
import { useToastActionState } from "@/modules/notifications/use-toast-action-state";
import { configureField } from "./actions";
import type { FieldDefinition, FieldEntity } from "./validation";
export const typeLabels = {
  text: "Текст",
  number: "Число",
  date: "Дата",
  boolean: "Да / нет",
  select: "Список вариантов",
};
export function DefinitionForm({
  entity,
  field,
}: {
  entity: FieldEntity;
  field?: FieldDefinition;
}) {
  const initial = {
    name: field?.name ?? "",
    type: field?.type ?? "text",
    options: field?.options.join("\n") ?? "",
    position: String(field?.position ?? 0),
    required: field?.required ?? false,
  };
  const [draft, setDraft] = useState(initial);
  const [state, action, pending] = useToastActionState(
    async (previous, form: FormData) => {
      const next = await configureField(previous, form);
      if (next.success && !field) setDraft(initial);
      return next;
    },
    {} as import("./actions").FieldState,
  );
  return (
    <OrganizationForm
      action={action}
      className="space-y-4 rounded-xl border border-slate-200 bg-white p-5"
    >
      <input type="hidden" name="entity" value={entity} />
      {field && (
        <>
          <input type="hidden" name="id" value={field.id} />
          <input type="hidden" name="version" value={field.version} />
        </>
      )}
      <label className="block text-sm">
        Название
        <input
          name="name"
          required
          maxLength={80}
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          className="mt-1 block w-full rounded border p-2"
        />
      </label>
      <label className="block text-sm">
        Тип
        <select
          name="type"
          value={draft.type}
          onChange={(e) =>
            setDraft({
              ...draft,
              type: e.target.value as FieldDefinition["type"],
              options: "",
            })
          }
          disabled={!!field}
          className="mt-1 block w-full rounded border p-2"
        >
          {Object.entries(typeLabels).map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {field && <input type="hidden" name="type" value={field.type} />}
      <label className="block text-sm">
        Варианты списка — по одному на строку
        <textarea
          name="options"
          readOnly={!!field}
          value={draft.options}
          onChange={(e) => setDraft({ ...draft, options: e.target.value })}
          disabled={draft.type !== "select"}
          maxLength={2500}
          className="mt-1 block w-full rounded border p-2"
        />
      </label>
      <label className="block text-sm">
        Порядок
        <input
          name="position"
          type="number"
          min={0}
          max={999}
          required
          value={draft.position}
          onChange={(e) => setDraft({ ...draft, position: e.target.value })}
          className="ml-3 w-24 rounded border p-2"
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="required"
          checked={draft.required}
          onChange={(e) => setDraft({ ...draft, required: e.target.checked })}
        />
        Обязательное
      </label>
      {field?.archived && (
        <p className="text-sm text-slate-500">
          Поле в архиве. Значения сохранены в карточках.
        </p>
      )}
      {state.message && (
        <p
          role="status"
          className={state.success ? "text-green-700" : "text-red-700"}
        >
          {state.message}
        </p>
      )}
      <div className="flex gap-3">
        <button
          name="operation"
          value={field ? (field.archived ? "restore" : "update") : "create"}
          disabled={pending}
          className="rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {field
            ? field.archived
              ? "Восстановить"
              : "Сохранить"
            : "Создать поле"}
        </button>
        {field && !field.archived && (
          <button
            name="operation"
            value="archive"
            disabled={pending}
            className="rounded border px-4 py-2 text-sm"
          >
            В архив
          </button>
        )}
      </div>
    </OrganizationForm>
  );
}
