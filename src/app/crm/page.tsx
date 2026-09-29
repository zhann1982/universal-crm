import {
  and,
  asc,
  count,
  eq,
  isNotNull,
  isNull,
  lt,
  notInArray,
} from "drizzle-orm";
import Link from "next/link";

import { db } from "@/db";
import {
  clients,
  organizationMembers,
  roles,
  tasks,
} from "@/db/schema";
import {
  getCurrentAccessContext,
} from "@/lib/auth/permissions";

import {
  TaskDueAt,
} from "./tasks/task-due-at";

type DashboardCard = {
  title: string;
  value:
    | string
    | number;
  href?: string;
};

export default async function CrmDashboardPage() {
  const {
    organization,
    member,
    permissions,
  } =
    await getCurrentAccessContext();

  const cards:
    DashboardCard[] = [];

  if (
    permissions.has(
      "clients.read",
    )
  ) {
    const [clientsResult] =
      await db
        .select({
          count: count(),
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
          ),
        );

    cards.push({
      title: "Клиенты",
      value:
        clientsResult.count,
      href: "/crm/clients",
    });
  }

  if (
    permissions.has(
      "members.read",
    )
  ) {
    const [membersResult] =
      await db
        .select({
          count: count(),
        })
        .from(
          organizationMembers,
        )
        .where(
          eq(
            organizationMembers.organizationId,
            organization.id,
          ),
        );

    cards.push({
      title: "Сотрудники",
      value:
        membersResult.count,
      href: "/crm/team",
    });
  }

  if (
    permissions.has(
      "roles.read",
    )
  ) {
    const [rolesResult] =
      await db
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

    cards.push({
      title: "Роли",
      value:
        rolesResult.count,
    });
  }

  let myTaskRows: Array<{
    id: string;
    title: string;
    priority: string;
    dueAt: Date | null;
  }> = [];

  if (
    permissions.has(
      "tasks.read",
    )
  ) {
    const activeTaskCondition =
      and(
        eq(
          tasks.organizationId,
          organization.id,
        ),
        eq(
          tasks.ownerMemberId,
          member.id,
        ),
        eq(
          tasks.isArchived,
          false,
        ),
        isNull(
          tasks.deletedAt,
        ),
        notInArray(
          tasks.status,
          [
            "completed",
            "cancelled",
          ],
        ),
      );

    const [myTasksResult] =
      await db
        .select({
          count: count(),
        })
        .from(tasks)
        .where(
          activeTaskCondition,
        );

    const [overdueTasksResult] =
      await db
        .select({
          count: count(),
        })
        .from(tasks)
        .where(
          and(
            activeTaskCondition,
            isNotNull(
              tasks.dueAt,
            ),
            lt(
              tasks.dueAt,
              new Date(),
            ),
          ),
        );

    cards.push(
      {
        title: "Мои активные задачи",
        value:
          myTasksResult.count,
        href:
          "/crm/tasks?view=mine",
      },
      {
        title: "Просроченные задачи",
        value:
          overdueTasksResult.count,
        href:
          "/crm/tasks?view=overdue",
      },
    );

    myTaskRows =
      await db
        .select({
          id: tasks.id,
          title: tasks.title,
          priority:
            tasks.priority,
          dueAt: tasks.dueAt,
        })
        .from(tasks)
        .where(
          and(
            activeTaskCondition,
            isNotNull(
              tasks.dueAt,
            ),
          ),
        )
        .orderBy(
          asc(tasks.dueAt),
        )
        .limit(6);
  }

  cards.push({
    title: "Организация",
    value:
      organization.name,
  });

  const now = new Date();

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
        {cards.map(
          (card) => {
            const content = (
              <>
                <div className="text-sm text-slate-500">
                  {card.title}
                </div>

                <div className="mt-3 text-2xl font-bold">
                  {card.value}
                </div>
              </>
            );

            return card.href ? (
              <Link
                key={card.title}
                href={card.href}
                className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-300 hover:shadow"
              >
                {content}
              </Link>
            ) : (
              <div
                key={card.title}
                className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                {content}
              </div>
            );
          },
        )}
      </div>

      {permissions.has(
        "tasks.read",
      ) && (
        <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">
                Ближайшие мои задачи
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Активные задачи со сроком выполнения.
              </p>
            </div>

            <Link
              href="/crm/tasks?view=mine"
              className="text-sm font-medium text-slate-600 transition hover:text-slate-950"
            >
              Все мои задачи →
            </Link>
          </div>

          {myTaskRows.length === 0 ? (
            <p className="mt-5 text-sm text-slate-400">
              Задач со сроком пока нет.
            </p>
          ) : (
            <div className="mt-5 divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200">
              {myTaskRows.map(
                (task) => {
                  const isOverdue = Boolean(
                    task.dueAt &&
                      task.dueAt < now,
                  );

                  return (
                    <div
                      key={task.id}
                      className="flex flex-wrap items-center justify-between gap-4 px-4 py-3"
                    >
                      <div>
                        <Link
                          href={`/crm/tasks/${task.id}`}
                          className="font-medium transition hover:text-blue-700 hover:underline"
                        >
                          {task.title}
                        </Link>

                        <div className="mt-1 text-xs text-slate-500">
                          {task.priority ===
                            "urgent"
                            ? "Срочный"
                            : task.priority ===
                                "high"
                              ? "Высокий приоритет"
                              : "Обычная задача"}
                        </div>
                      </div>

                      <div
                        className={
                          isOverdue
                            ? "text-sm font-medium text-red-700"
                            : "text-sm text-slate-600"
                        }
                      >
                        {task.dueAt ? (
                          <TaskDueAt
                            value={
                              task.dueAt.toISOString()
                            }
                          />
                        ) : (
                          "—"
                        )}
                      </div>
                    </div>
                  );
                },
              )}
            </div>
          )}
        </section>
      )}

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
