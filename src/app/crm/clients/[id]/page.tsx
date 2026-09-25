import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { getClientById } from "@/lib/clients/get-client";

const clientIdSchema = z.string().uuid();

const statusLabels: Record<string, string> = {
  active: "Активный",
  lead: "Лид",
  inactive: "Неактивный",
};

export default async function ClientPage({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  const { id } = await params;

  const idResult =
    clientIdSchema.safeParse(id);

  if (!idResult.success) {
    notFound();
  }

  const client =
    await getClientById(idResult.data);

  if (!client) {
    notFound();
  }

  const fullName = [
    client.lastName,
    client.firstName,
    client.middleName,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8">
        <Link
          href="/crm/clients"
          className="text-sm text-slate-500 transition hover:text-slate-900"
        >
          ← Назад к клиентам
        </Link>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold">
                {fullName || "Без имени"}
              </h1>

              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium">
                {statusLabels[client.status] ??
                  client.status}
              </span>

              {client.isArchived && (
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
                  В архиве
                </span>
              )}
            </div>

            <p className="mt-2 text-sm text-slate-500">
              Клиент с{" "}
              {client.createdAt.toLocaleDateString(
                "ru-RU",
              )}
            </p>
          </div>

          <Link
            href={`/crm/clients/${client.id}/edit`}
            className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium transition hover:bg-slate-50"
          >
            Редактировать
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
          <h2 className="text-lg font-semibold">
            Контактная информация
          </h2>

          <dl className="mt-6 grid gap-6 sm:grid-cols-2">
            <InfoItem
              label="Имя"
              value={client.firstName}
            />

            <InfoItem
              label="Фамилия"
              value={client.lastName}
            />

            <InfoItem
              label="Отчество"
              value={client.middleName}
            />

            <InfoItem
              label="Телефон"
              value={client.phone}
            />

            <InfoItem
              label="Email"
              value={client.email}
            />

            <InfoItem
              label="Источник"
              value={client.source}
            />
          </dl>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">
            Системная информация
          </h2>

          <dl className="mt-6 space-y-5">
            <InfoItem
              label="Статус"
              value={
                statusLabels[client.status] ??
                client.status
              }
            />

            <InfoItem
              label="Создан"
              value={client.createdAt.toLocaleString(
                "ru-RU",
              )}
            />

            <InfoItem
              label="Обновлён"
              value={client.updatedAt.toLocaleString(
                "ru-RU",
              )}
            />
          </dl>
        </section>
      </div>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">
          Заметки
        </h2>

        {client.notes ? (
          <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">
            {client.notes}
          </p>
        ) : (
          <p className="mt-4 text-sm text-slate-400">
            Заметок пока нет.
          </p>
        )}
      </section>
    </div>
  );
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value:
    | string
    | null
    | undefined;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </dt>

      <dd className="mt-1.5 break-words text-sm text-slate-800">
        {value || "—"}
      </dd>
    </div>
  );
}