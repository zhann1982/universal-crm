"use client";
import { useState } from "react";
import type { FieldDefinition } from "./validation";
export function CustomFieldInputs({
  fields,
  revision,
  values = {},
}: {
  fields: FieldDefinition[];
  revision: number;
  values?: Record<string, string>;
}) {
  const [draft] = useState({ fields, revision });
  const [input, setInput] = useState(values);
  const change = (id: string, value: string) =>
    setInput((previous) => ({ ...previous, [id]: value }));
  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
      <input type="hidden" name="customFieldSchema" value={draft.revision} />
      <h2 className="text-lg font-semibold">Пользовательские поля</h2>
      {draft.fields
        .filter((f) => !f.archived)
        .map((f) => (
          <label key={f.id} className="block text-sm font-medium">
            {f.name}
            {f.required ? " *" : ""}
            {f.type === "select" || f.type === "boolean" ? (
              <select
                name={`custom:${f.id}`}
                value={input[f.id] ?? ""}
                onChange={(e) => change(f.id, e.target.value)}
                required={f.required}
                className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2"
              >
                <option value="">Не указано</option>
                {(f.type === "boolean" ? ["true", "false"] : f.options).map(
                  (v) => (
                    <option key={v} value={v}>
                      {f.type === "boolean" ? (v === "true" ? "Да" : "Нет") : v}
                    </option>
                  ),
                )}
              </select>
            ) : (
              <input
                name={`custom:${f.id}`}
                type={f.type === "date" ? "date" : "text"}
                inputMode={f.type === "number" ? "decimal" : undefined}
                required={f.required}
                maxLength={2000}
                value={input[f.id] ?? ""}
                onChange={(e) => change(f.id, e.target.value)}
                className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            )}
          </label>
        ))}
      {!draft.fields.some((f) => !f.archived) && (
        <p className="text-sm text-slate-500">
          Для этого раздела поля ещё не настроены.
        </p>
      )}
    </section>
  );
}
