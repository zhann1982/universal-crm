import { count } from "drizzle-orm";

import { db } from "@/db";
import {
  clients,
  organizationMembers,
  organizations,
  roles,
} from "@/db/schema";

export default async function CrmDashboardPage() {
  const [clientsResult] = await db
    .select({ count: count() })
    .from(clients);

  const [membersResult] = await db
    .select({ count: count() })
    .from(organizationMembers);

  const [rolesResult] = await db
    .select({ count: count() })
    .from(roles);

  const [organizationsResult] = await db
    .select({ count: count() })
    .from(organizations);

  const cards = [
    {
      title: "Клиенты",
      value: clientsResult.count,
    },
    {
      title: "Сотрудники",
      value: membersResult.count,
    },
    {
      title: "Роли",
      value: rolesResult.count,
    },
    {
      title: "Организации",
      value: organizationsResult.count,
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Dashboard</h1>

        <p className="mt-2 text-slate-500">
          Обзор вашей CRM.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.title}
            className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="text-sm text-slate-500">
              {card.title}
            </div>

            <div className="mt-3 text-3xl font-bold">
              {card.value}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold">
          CRM работает
        </h2>

        <p className="mt-2 text-sm text-slate-500">
          Dashboard получает данные непосредственно из PostgreSQL Neon.
        </p>
      </div>
    </div>
  );
}