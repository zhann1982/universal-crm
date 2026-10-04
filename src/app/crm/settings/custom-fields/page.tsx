import Link from "@/components/app-link";
import { requirePermission } from "@/lib/auth/permissions";
import { readDefinitions } from "@/modules/custom-fields/persistence";
import { DefinitionForm } from "@/modules/custom-fields/definition-form";
import { entitySchema } from "@/modules/custom-fields/validation";
export default async function CustomFieldsPage({
  searchParams,
}: {
  searchParams: Promise<{ entity?: string }>;
}) {
  const { organization } = await requirePermission("settings.manage");
  const query = await searchParams;
  const entity = entitySchema.safeParse(query.entity).data ?? "client";
  const config = await readDefinitions(organization.id, entity);
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <h1 className="text-3xl font-bold">Пользовательские поля</h1>
      <p className="text-sm text-slate-600">
        Настройте сведения для своей организации. Тип и варианты созданного поля
        фиксированы. Обязательные поля проверяются при создании записи и
        сохранении дополнительных сведений; старые записи сохраняются.
      </p>
      <nav className="flex gap-3">
        {Object.entries({
          client: "Клиенты",
          company: "Компании",
          deal: "Сделки",
        }).map(([v, label]) => (
          <Link
            key={v}
            href={`/crm/settings/custom-fields?entity=${v}`}
            aria-current={v === entity ? "page" : undefined}
            className={`rounded-lg border px-4 py-2 ${v === entity ? "bg-slate-900 text-white" : "bg-white"}`}
          >
            {label}
          </Link>
        ))}
      </nav>
      <details className="rounded-xl border bg-white p-5">
        <summary className="cursor-pointer font-semibold">
          Добавить поле
        </summary>
        <div className="mt-4">
          <DefinitionForm key={entity} entity={entity} />
        </div>
      </details>
      <p className="text-sm text-slate-500">
        Активных: {config.fields.filter((f) => !f.archived).length} / 50. Всего:{" "}
        {config.fields.length} / 150.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {config.fields.map((field) => (
          <DefinitionForm
            key={`${field.id}:${field.version}`}
            entity={entity}
            field={field}
          />
        ))}
      </div>
    </div>
  );
}
