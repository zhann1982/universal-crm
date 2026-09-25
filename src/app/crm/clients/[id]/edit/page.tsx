import Link from "next/link";
import { notFound } from "next/navigation";

import { getClientById } from "@/lib/clients/get-client";
import { clientIdSchema } from "@/lib/validation/client";

import { EditClientForm } from "./edit-client-form";
import { requirePermission } from "@/lib/auth/permissions";

export default async function EditClientPage({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  await requirePermission(
    "clients.update",
  );

  const { id } = await params;

  const idResult =
    clientIdSchema.safeParse(id);

  if (!idResult.success) {
    notFound();
  }

  const client =
    await getClientById(
      idResult.data,
    );

  if (
    !client ||
    client.isArchived
  ) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8">
        <Link
          href={`/crm/clients/${client.id}`}
          className="text-sm text-slate-500 transition hover:text-slate-900"
        >
          ← Назад к клиенту
        </Link>

        <h1 className="mt-4 text-3xl font-bold">
          Редактирование клиента
        </h1>

        <p className="mt-2 text-slate-500">
          Измените данные клиента.
        </p>
      </div>

      <EditClientForm
        client={client}
      />
    </div>
  );
}