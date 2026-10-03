import {
  and,
  asc,
  eq,
  isNull,
} from "drizzle-orm";
import Link from "@/components/app-link";
import {
  notFound,
  redirect,
} from "next/navigation";

import { db } from "@/db";
import {
  clients,
  companies,
  deals,
  organizationMembers,
  tasks,
} from "@/db/schema";
import {
  requirePermission,
} from "@/lib/auth/permissions";
import {
  taskSchedules,
} from "@/db/task-scheduling-schema";
import {
  taskIdSchema,
} from "@/lib/validation/task";

import {
  TaskEditForm,
} from "./task-edit-form";

type Option = {
  id: string;
  label: string;
};

export default async function EditTaskPage({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  const {
    organization,
    member,
    permissions,
  } = await requirePermission(
    "tasks.update",
  );

  const { id } = await params;

  const idResult =
    taskIdSchema.safeParse(id);

  if (!idResult.success) {
    notFound();
  }

  const [task] =
    await db
      .select({
        id: tasks.id,
        title: tasks.title,
        description:
          tasks.description,
        status: tasks.status,
        priority:
          tasks.priority,
        dueAt: tasks.dueAt,
        ownerMemberId:
          tasks.ownerMemberId,
        clientId:
          tasks.clientId,
        companyId:
          tasks.companyId,
        dealId:
          tasks.dealId,
        isArchived:
          tasks.isArchived,
        version: tasks.version,
      })
      .from(tasks)
      .where(
        and(
          eq(
            tasks.id,
            idResult.data,
          ),
          eq(
            tasks.organizationId,
            organization.id,
          ),
          isNull(
            tasks.deletedAt,
          ),
        ),
      )
      .limit(1);

  if (!task) {
    notFound();
  }

  if (task.isArchived) {
    redirect(
      `/crm/tasks/${task.id}`,
    );
  }

  const [schedule] =
    await db
      .select({
        reminderAt:
          taskSchedules.reminderAt,
        recurrenceFrequency:
          taskSchedules.recurrenceFrequency,
        recurrenceInterval:
          taskSchedules.recurrenceInterval,
        recurrenceEndAt:
          taskSchedules.recurrenceEndAt,
      })
      .from(taskSchedules)
      .where(
        and(
          eq(
            taskSchedules.taskId,
            task.id,
          ),
          eq(
            taskSchedules.organizationId,
            organization.id,
          ),
        ),
      )
      .limit(1);

  let memberOptions: Option[];

  if (
    permissions.has(
      "members.read",
    )
  ) {
    const memberRows =
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

    memberOptions =
      memberRows.map((item) => ({
        id: item.id,
        label:
          item.displayName ||
          "Сотрудник",
      }));

    if (
      task.ownerMemberId &&
      !memberOptions.some(
        (item) =>
          item.id ===
          task.ownerMemberId,
      )
    ) {
      const [currentOwner] =
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
                organizationMembers.id,
                task.ownerMemberId,
              ),
              eq(
                organizationMembers.organizationId,
                organization.id,
              ),
            ),
          )
          .limit(1);

      if (currentOwner) {
        memberOptions.push({
          id: currentOwner.id,
          label:
            `${currentOwner.displayName || "Сотрудник"} (текущий)`,
        });
      }
    }
  } else {
    memberOptions = [
      {
        id: member.id,
        label:
          member.displayName ||
          "Я",
      },
    ];

    if (
      task.ownerMemberId &&
      task.ownerMemberId !==
        member.id
    ) {
      memberOptions.push({
        id:
          task.ownerMemberId,
        label:
          "Сотрудник (текущий)",
      });
    }
  }

  const canEditClients =
    permissions.has(
      "clients.read",
    );

  const canEditCompanies =
    permissions.has(
      "companies.read",
    );

  const canEditDeals =
    permissions.has(
      "deals.read",
    );

  const clientOptions: Option[] = [];

  if (canEditClients) {
    const rows =
      await db
        .select({
          id: clients.id,
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
        );

    clientOptions.push(
      ...rows.map((client) => ({
        id: client.id,
        label:
          [
            client.lastName,
            client.firstName,
          ]
            .filter(Boolean)
            .join(" ") ||
          client.phone ||
          "Клиент",
      })),
    );

    if (
      task.clientId &&
      !clientOptions.some(
        (item) =>
          item.id ===
          task.clientId,
      )
    ) {
      const [currentClient] =
        await db
          .select({
            id: clients.id,
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
                clients.id,
                task.clientId,
              ),
              eq(
                clients.organizationId,
                organization.id,
              ),
              isNull(
                clients.deletedAt,
              ),
            ),
          )
          .limit(1);

      if (currentClient) {
        clientOptions.push({
          id: currentClient.id,
          label:
            `${[
              currentClient.lastName,
              currentClient.firstName,
            ]
              .filter(Boolean)
              .join(" ") ||
              currentClient.phone ||
              "Клиент"} (текущая связь)`,
        });
      }
    }
  }

  const companyOptions: Option[] = [];

  if (canEditCompanies) {
    const rows =
      await db
        .select({
          id: companies.id,
          name: companies.name,
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
        );

    companyOptions.push(
      ...rows.map((company) => ({
        id: company.id,
        label: company.name,
      })),
    );

    if (
      task.companyId &&
      !companyOptions.some(
        (item) =>
          item.id ===
          task.companyId,
      )
    ) {
      const [currentCompany] =
        await db
          .select({
            id: companies.id,
            name: companies.name,
          })
          .from(companies)
          .where(
            and(
              eq(
                companies.id,
                task.companyId,
              ),
              eq(
                companies.organizationId,
                organization.id,
              ),
              isNull(
                companies.deletedAt,
              ),
            ),
          )
          .limit(1);

      if (currentCompany) {
        companyOptions.push({
          id: currentCompany.id,
          label:
            `${currentCompany.name} (текущая связь)`,
        });
      }
    }
  }

  const dealOptions: Option[] = [];

  if (canEditDeals) {
    const rows =
      await db
        .select({
          id: deals.id,
          title: deals.title,
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
        );

    dealOptions.push(
      ...rows.map((deal) => ({
        id: deal.id,
        label: deal.title,
      })),
    );

    if (
      task.dealId &&
      !dealOptions.some(
        (item) =>
          item.id ===
          task.dealId,
      )
    ) {
      const [currentDeal] =
        await db
          .select({
            id: deals.id,
            title: deals.title,
          })
          .from(deals)
          .where(
            and(
              eq(
                deals.id,
                task.dealId,
              ),
              eq(
                deals.organizationId,
                organization.id,
              ),
              isNull(
                deals.deletedAt,
              ),
            ),
          )
          .limit(1);

      if (currentDeal) {
        dealOptions.push({
          id: currentDeal.id,
          label:
            `${currentDeal.title} (текущая связь)`,
        });
      }
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8">
        <Link
          href={`/crm/tasks/${task.id}`}
          className="text-sm text-slate-500 transition hover:text-slate-900"
        >
          ← Назад к задаче
        </Link>

        <h1 className="mt-4 text-3xl font-bold">
          Редактировать задачу
        </h1>

        <p className="mt-2 text-slate-500">
          Измените параметры,
          ответственного и связи CRM.
        </p>
      </div>

      <TaskEditForm
        task={{
          id: task.id,
          title: task.title,
          description:
            task.description,
          status: task.status,
          priority:
            task.priority,
          dueAt:
            task.dueAt
              ? task.dueAt.toISOString()
              : null,
          reminderAt:
            schedule?.reminderAt
              ? schedule.reminderAt.toISOString()
              : null,
          recurrenceFrequency:
            schedule?.recurrenceFrequency ??
            "none",
          recurrenceInterval:
            schedule?.recurrenceInterval ??
            1,
          recurrenceEndAt:
            schedule?.recurrenceEndAt
              ? schedule.recurrenceEndAt.toISOString()
              : null,
          ownerMemberId:
            task.ownerMemberId,
          clientId:
            task.clientId,
          companyId:
            task.companyId,
          dealId:
            task.dealId,
          version:
            task.version,
        }}
        members={memberOptions}
        clients={clientOptions}
        companies={companyOptions}
        deals={dealOptions}
        canEditClients={
          canEditClients
        }
        canEditCompanies={
          canEditCompanies
        }
        canEditDeals={
          canEditDeals
        }
      />
    </div>
  );
}
