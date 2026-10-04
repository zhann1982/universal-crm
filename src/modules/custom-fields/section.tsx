import { fieldPermissions, canEditValues } from "./policy";
import { getCurrentAccessContext } from "@/lib/auth/permissions";
import { readDefinitions } from "./persistence";
import { CustomValueForm } from "./value-form";
import type { FieldEntity } from "./validation";
export async function CustomFieldsSection({
  entity,
  id,
  values,
  version,
  archived,
}: {
  entity: FieldEntity;
  id: string;
  values: Record<string, string>;
  version: number;
  archived: boolean;
}) {
  const context = await getCurrentAccessContext();
  if (!context.permissions.has(fieldPermissions[entity].read)) return null;
  const config = await readDefinitions(context.organization.id, entity);
  if (!config.fields.length) return null;
  return (
    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-semibold">Дополнительные сведения</h2>
      <dl className="mt-4 grid gap-4 md:grid-cols-2">
        {config.fields
          .filter((f) => !f.archived || values[f.id])
          .map((f) => (
            <div key={f.id}>
              <dt className="text-sm text-slate-500">
                {f.name}
                {f.archived ? " (поле в архиве)" : ""}
              </dt>
              <dd className="mt-1 whitespace-pre-wrap break-words text-sm">
                {f.type === "boolean" && values[f.id]
                  ? values[f.id] === "true"
                    ? "Да"
                    : "Нет"
                  : values[f.id] || "—"}
              </dd>
            </div>
          ))}
      </dl>
      {!archived && canEditValues(entity, context.permissions) && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium">
            Изменить поля
          </summary>
          <CustomValueForm
            entity={entity}
            id={id}
            values={values}
            version={version}
            fields={config.fields}
            revision={config.revision}
          />
        </details>
      )}
    </section>
  );
}
