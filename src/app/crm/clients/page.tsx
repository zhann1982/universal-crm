import { and, desc, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { clients } from "@/db/schema";
import { getCurrentOrganization } from "@/lib/current-organization";

export default async function ClientsPage() {
  const organization = await getCurrentOrganization();

  const clientList = await db
    .select()
    .from(clients)
    .where(
      and(
        eq(
          clients.organizationId,
          organization.id,
        ),
        eq(clients.isArchived, false),
        isNull(clients.deletedAt),
      ),
    )
    .orderBy(desc(clients.createdAt));

  return (
    <div>
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">
            Клиенты
          </h1>

          <p className="mt-2 text-slate-500">
            Всего активных клиентов: {clientList.length}
          </p>
        </div>

        <button
          type="button"
          className="rounded-lg bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          + Новый клиент
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4">
          <input
            type="search"
            placeholder="Поиск клиентов..."
            disabled
            className="w-full max-w-md rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none disabled:cursor-not-allowed"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-5 py-4 text-sm font-medium">
                  Клиент
                </th>

                <th className="px-5 py-4 text-sm font-medium">
                  Телефон
                </th>

                <th className="px-5 py-4 text-sm font-medium">
                  Email
                </th>

                <th className="px-5 py-4 text-sm font-medium">
                  Статус
                </th>

                <th className="px-5 py-4 text-sm font-medium">
                  Источник
                </th>

                <th className="px-5 py-4 text-sm font-medium">
                  Создан
                </th>
              </tr>
            </thead>

            <tbody>
              {clientList.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-20 text-center"
                  >
                    <div className="font-medium">
                      Клиентов пока нет
                    </div>

                    <div className="mt-2 text-sm text-slate-500">
                      Создайте первого клиента.
                    </div>
                  </td>
                </tr>
              ) : (
                clientList.map((client) => {
                  const fullName = [
                    client.lastName,
                    client.firstName,
                    client.middleName,
                  ]
                    .filter(Boolean)
                    .join(" ");

                  return (
                    <tr
                      key={client.id}
                      className="border-b border-slate-100 last:border-b-0"
                    >
                      <td className="px-5 py-4 font-medium">
                        {fullName || "Без имени"}
                      </td>

                      <td className="px-5 py-4 text-slate-600">
                        {client.phone || "—"}
                      </td>

                      <td className="px-5 py-4 text-slate-600">
                        {client.email || "—"}
                      </td>

                      <td className="px-5 py-4">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium">
                          {client.status}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-slate-600">
                        {client.source || "—"}
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-500">
                        {client.createdAt.toLocaleDateString(
                          "ru-RU",
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}