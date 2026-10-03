import {
  and,
  asc,
  eq,
  isNull,
} from "drizzle-orm";
import Link from "@/components/app-link";

import { db } from "@/db";
import {
  clients,
  companies,
  deals,
  organizationMembers,
} from "@/db/schema";
import {
  requirePermission,
} from "@/lib/auth/permissions";

import {
  TaskForm,
} from "./task-form";

type SearchParams = {
  [key: string]:
    | string
    | string[]
    | undefined;
};

function getSingleValue(
  value:
    | string
    | string[]
    | undefined,
) {
  return Array.isArray(value)
    ? value[0]
    : value;
}

export default async function NewTaskPage({
  searchParams,
}: {
  searchParams:
    Promise<SearchParams>;
}) {
  const {
    organization,
    member,
    permissions,
  } = await requirePermission(
    "tasks.create",
  );

  const rawSearchParams =
    await searchParams;

  let memberList: Array<{
    id: string;
    label: string;
  }>;

  if (
    permissions.has(
      "members.read",
    )
  ) {
    const members =
      await db
        .select({
          id:
            organizationMembers.id,

          displayName:
            organizationMembers.displayName,
        })
        .from(
          organizationMembers,
        )
        .where(
          and(
            eq(
              organizationMembers.organizationId,
              organization.id,
            ),

            eq(
              organizationMembers.status,
              "active",
            ),
          ),
        )
        .orderBy(
          asc(
            organizationMembers.displayName,
          ),
        );

    memberList = members.map(
      (item) => ({
        id: item.id,
        label:
          item.displayName ||
          "Сотрудник",
      }),
    );
  } else {
    memberList = [
      {
        id: member.id,
        label:
          member.displayName ||
          "Я",
      },
    ];
  }

  const clientList =
    permissions.has(
      "clients.read",
    )
      ? await db
          .select({
            id:
              clients.id,

            firstName:
              clients.firstName,

            lastName:
              clients.lastName,

            phone:
              clients.phone,
          })
          .from(clients)
          .where(
            and(
              eq(
                clients.organizationId,
                organization.id,
              ),

              eq(
                clients.isArchived,
                false,
              ),

              isNull(
                clients.deletedAt,
              ),
            ),
          )
          .orderBy(
            asc(
              clients.lastName,
            ),
            asc(
              clients.firstName,
            ),
          )
      : [];

  const companyList =
    permissions.has(
      "companies.read",
    )
      ? await db
          .select({
            id:
              companies.id,

            name:
              companies.name,
          })
          .from(companies)
          .where(
            and(
              eq(
                companies.organizationId,
                organization.id,
              ),

              eq(
                companies.isArchived,
                false,
              ),

              isNull(
                companies.deletedAt,
              ),
            ),
          )
          .orderBy(
            asc(
              companies.name,
            ),
          )
      : [];

  const dealList =
    permissions.has(
      "deals.read",
    )
      ? await db
          .select({
            id:
              deals.id,

            title:
              deals.title,
          })
          .from(deals)
          .where(
            and(
              eq(
                deals.organizationId,
                organization.id,
              ),

              eq(
                deals.isArchived,
                false,
              ),

              isNull(
                deals.deletedAt,
              ),
            ),
          )
          .orderBy(
            asc(
              deals.title,
            ),
          )
      : [];

  const requestedClientId =
    getSingleValue(
      rawSearchParams.clientId,
    );

  const requestedCompanyId =
    getSingleValue(
      rawSearchParams.companyId,
    );

  const requestedDealId =
    getSingleValue(
      rawSearchParams.dealId,
    );

  const defaultClientId =
    requestedClientId &&
    clientList.some(
      (client) =>
        client.id ===
        requestedClientId,
    )
      ? requestedClientId
      : "";

  const defaultCompanyId =
    requestedCompanyId &&
    companyList.some(
      (company) =>
        company.id ===
        requestedCompanyId,
    )
      ? requestedCompanyId
      : "";

  const defaultDealId =
    requestedDealId &&
    dealList.some(
      (deal) =>
        deal.id ===
        requestedDealId,
    )
      ? requestedDealId
      : "";

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8">
        <Link
          href="/crm/tasks"
          className="text-sm text-slate-500 transition hover:text-slate-900"
        >
          ← Назад к задачам
        </Link>

        <h1 className="mt-4 text-3xl font-bold">
          Новая задача
        </h1>

        <p className="mt-2 text-slate-500">
          Создайте рабочую задачу,
          назначьте ответственного и
          при необходимости свяжите её
          с клиентом, компанией или
          сделкой.
        </p>
      </div>

      <TaskForm
        members={
          memberList
        }
        clients={
          clientList.map(
            (client) => ({
              id:
                client.id,

              label:
                [
                  client.lastName,
                  client.firstName,
                ]
                  .filter(Boolean)
                  .join(" ") ||
                client.phone ||
                "Клиент",
            }),
          )
        }
        companies={
          companyList.map(
            (company) => ({
              id:
                company.id,

              label:
                company.name,
            }),
          )
        }
        deals={
          dealList.map(
            (deal) => ({
              id:
                deal.id,

              label:
                deal.title,
            }),
          )
        }
        defaultOwnerMemberId={
          member.id
        }
        defaultClientId={
          defaultClientId
        }
        defaultCompanyId={
          defaultCompanyId
        }
        defaultDealId={
          defaultDealId
        }
      />
    </div>
  );
}
