import { and, count, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  clients,
  organizationMembers,
  roles,
} from "@/db/schema";
import { getCurrentOrganization } from "@/lib/current-organization";

export default async function CrmDashboardPage() {
  const organization = await getCurrentOrganization();

  const [clientsResult] = await db
    .select({
      count: count(),
    })
    .from(clients)
    .where(
      and(
        eq(clients.organizationId, organization.id),
        eq(clients.isArchived, false),
      ),
    );

  const [membersResult] = await db
    .select({
      count: count(),
    })
    .from(organizationMembers)
    .where(
      eq(
        organizationMembers.organizationId,
        organization.id,
      ),
    );

  const [rolesResult] = await db
    .select({
      count: count(),
    })
    .from(roles)
    .where(
      eq(
        roles.organizationId,
        organization.id,
      ),
    );

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
      title: "Организация",
      value: organization.name,
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">
          Dashboard
        </h1>

        <p className="mt-2 text-slate-500">
          Основные показатели CRM.
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

            <div className="mt-3 text-2xl font-bold">
              {card.value}
            </div>
          </div>
        ))}
      </div>

      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold">
          Состояние системы
        </h2>

        <div className="mt-4 flex items-center gap-3">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />

          <span className="text-sm text-slate-600">
            PostgreSQL Neon подключён
          </span>
        </div>
      </section>
    </div>
  );
}