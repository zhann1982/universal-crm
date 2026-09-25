import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  clients,
  organizations,
} from "@/db/schema";

export default async function ClientsPage() {
  const [organization] = await db
    .select({
      id: organizations.id,
    })
    .from(organizations)
    .where(eq(organizations.slug, "development"))
    .limit(1);

  if (!organization) {
    return (
      <div>
        <h1 className="text-3xl font-bold">
          Клиенты
        </h1>

        <p className="mt-4 text-red-600">
          Организация Development CRM не найдена.
        </p>
      </div>
    );
  }

  const clientList = await db
    .select()
    .from(clients)
    .where(
      eq(
        clients.organizationId,
        organization.id,
      ),
    )
    .orderBy(desc(clients.createdAt));

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            Клиенты
          </h1>

          <p className="mt-2 text-slate-500">
            Всего клиентов: {clientList.length}
          </p>
        </div>

        <button
          type="button"
          className="rounded-lg bg-slate-900 px-5 py-3 text-sm font-medium text-white"
        >
          + Новый клиент
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
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
            </tr>
          </thead>

          <tbody>
            {clientList.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-5 py-16 text-center text-slate-500"
                >
                  Клиентов пока нет.
                </td>
              </tr>
            ) : (
              clientList.map((client) => (
                <tr
                  key={client.id}
                  className="border-b border-slate-100"
                >
                  <td className="px-5 py-4">
                    {[
                      client.lastName,
                      client.firstName,
                      client.middleName,
                    ]
                      .filter(Boolean)
                      .join(" ") || "Без имени"}
                  </td>

                  <td className="px-5 py-4 text-slate-600">
                    {client.phone || "—"}
                  </td>

                  <td className="px-5 py-4 text-slate-600">
                    {client.email || "—"}
                  </td>

                  <td className="px-5 py-4">
                    {client.status}
                  </td>

                  <td className="px-5 py-4 text-slate-600">
                    {client.source || "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
