import { CustomFieldInputs } from "@/modules/custom-fields/inputs";
import { readDefinitions } from "@/modules/custom-fields/persistence";
import Link from "@/components/app-link";

import { ClientForm } from "./client-form";
import { requirePermission } from "@/lib/auth/permissions";

export default async function NewClientPage() {
  const {organization}=await requirePermission(
    "clients.create",
  );
  const customConfig=await readDefinitions(organization.id,"client");
  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8">
        <Link
          href="/crm/clients"
          className="text-sm text-slate-500 transition hover:text-slate-900"
        >
          ← Назад к клиентам
        </Link>

        <h1 className="mt-4 text-3xl font-bold">
          Новый клиент
        </h1>

        <p className="mt-2 text-slate-500">
          Добавьте клиента в CRM.
        </p>
      </div>

      <ClientForm><CustomFieldInputs fields={customConfig.fields} revision={customConfig.revision}/></ClientForm>
    </div>
  );
}