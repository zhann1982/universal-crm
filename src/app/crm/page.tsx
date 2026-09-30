import { OrganizationForm } from "@/modules/access/organization-context";
import {
  and,
  asc,
  count,
  eq,
  isNotNull,
  isNull,
  lt,
  lte,
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
  taskSchedules,
} from "@/db/task-scheduling-schema";

import {
  completeTask,
  dismissTaskReminder,
} from "./tasks/actions";
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

type TaskSummary = {
  active: number;
  overdue: number;
  urgent: number;
  withoutDueAt: number;
  reminders: number;
};

type ReminderRow = {
  id: string;
  title: string;
  reminderAt: Date;
  scheduleVersion: number;
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

  cards.push({
    title: "Организация",
    value:
      organization.name,
  });

  let taskSummary:
    TaskSummary | null = null;

  let myTaskRows: Array<{
    id: string;
    title: string;
    priority: string;
    status: string;
    dueAt: Date | null;
    version: number;
  }> = [];

  let reminderRows:
    ReminderRow[] = [];

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

    const now = new Date();

    const [activeResult] =
      await db
        .select({
          count: count(),
        })
        .from(tasks)
        .where(
          activeTaskCondition,
        );

    const [overdueResult] =
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
              now,
            ),
          ),
        );

    const [urgentResult] =
      await db
        .select({
          count: count(),
        })
        .from(tasks)
        .where(
          and(
            activeTaskCondition,
            eq(
              tasks.priority,
              "urgent",
            ),
          ),
        );

    const [withoutDueAtResult] =
      await db
        .select({
          count: count(),
        })
        .from(tasks)
        .where(
          and(
            activeTaskCondition,
            isNull(
              tasks.dueAt,
            ),
          ),
        );

    const [reminderCountResult] =
      await db
        .select({
          count: count(),
        })
        .from(tasks)
        .innerJoin(
          taskSchedules,
          and(
            eq(
              taskSchedules.taskId,
              tasks.id,
            ),
            eq(
              taskSchedules.organizationId,
              organization.id,
            ),
          ),
        )
        .where(
          and(
            activeTaskCondition,
            isNotNull(
              taskSchedules.reminderAt,
            ),
            lte(
              taskSchedules.reminderAt,
              now,
            ),
            isNull(
              taskSchedules.reminderDismissedAt,
            ),
          ),
        );

    const reminderQueryRows =
      await db
        .select({
          id: tasks.id,
          title: tasks.title,
          reminderAt:
            taskSchedules.reminderAt,
          scheduleVersion:
            taskSchedules.version,
        })
        .from(tasks)
        .innerJoin(
          taskSchedules,
          and(
            eq(
              taskSchedules.taskId,
              tasks.id,
            ),
            eq(
              taskSchedules.organizationId,
              organization.id,
            ),
          ),
        )
        .where(
          and(
            activeTaskCondition,
            isNotNull(
              taskSchedules.reminderAt,
            ),
            lte(
              taskSchedules.reminderAt,
              now,
            ),
            isNull(
              taskSchedules.reminderDismissedAt,
            ),
          ),
        )
        .orderBy(
          asc(
            taskSchedules.reminderAt,
          ),
        )
        .limit(6);

    reminderRows =
      reminderQueryRows.flatMap(
        (row) =>
          row.reminderAt
            ? [
                {
                  id: row.id,
                  title: row.title,
                  reminderAt:
                    row.reminderAt,
                  scheduleVersion:
                    row.scheduleVersion,
                },
              ]
            : [],
      );

    taskSummary = {
      active:
        activeResult.count,
      overdue:
        overdueResult.count,
      urgent:
        urgentResult.count,
      withoutDueAt:
        withoutDueAtResult.count,
      reminders:
        reminderCountResult.count,
    };

    myTaskRows =
      await db
        .select({
          id: tasks.id,
          title: tasks.title,
          priority:
            tasks.priority,
          status:
            tasks.status,
          dueAt: tasks.dueAt,
          version:
            tasks.version,
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
        .limit(8);
  }

  const now = new Date();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">
          Dashboard
        </h1>

        <p className="mt-2 text-slate-500">
          Основные показатели CRM и мои ближайшие действия.
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

      {taskSummary && (
        <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">
                Мои задачи
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Краткая рабочая сводка по активным задачам.
              </p>
            </div>

            <Link
              href="/crm/tasks?view=mine"
              className="text-sm font-medium text-slate-600 transition hover:text-slate-950"
            >
              Открыть задачи →
            </Link>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <TaskSummaryCard
              label="Активные"
              value={
                taskSummary.active
              }
              href="/crm/tasks?view=mine"
            />

            <TaskSummaryCard
              label="Просроченные"
              value={
                taskSummary.overdue
              }
              href="/crm/tasks?view=mine&due=overdue"
              danger={
                taskSummary.overdue > 0
              }
            />

            <TaskSummaryCard
              label="Срочные"
              value={
                taskSummary.urgent
              }
              href="/crm/tasks?view=mine&priority=urgent"
            />

            <TaskSummaryCard
              label="Без срока"
              value={
                taskSummary.withoutDueAt
              }
              href="/crm/tasks?view=mine&due=none"
            />

            <TaskSummaryCard
              label="Напоминания"
              value={
                taskSummary.reminders
              }
              href="/crm/tasks?view=reminders&owner=mine"
              danger={
                taskSummary.reminders > 0
              }
            />
          </div>
        </section>
      )}

      {permissions.has(
        "tasks.read",
      ) &&
        reminderRows.length > 0 && (
          <section className="mt-8 rounded-xl border border-amber-200 bg-amber-50/50 p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-amber-950">
                  Напоминания
                </h2>

                <p className="mt-1 text-sm text-amber-800">
                  Напоминания по моим активным задачам, время которых уже наступило.
                </p>
              </div>

              <Link
                href="/crm/tasks?view=reminders&owner=mine"
                className="text-sm font-medium text-amber-900 transition hover:text-amber-700"
              >
                Все напоминания →
              </Link>
            </div>

            <div className="mt-5 divide-y divide-amber-100 overflow-hidden rounded-lg border border-amber-200 bg-white">
              {reminderRows.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-4 px-4 py-3"
                >
                  <div>
                    <Link
                      href={`/crm/tasks/${item.id}`}
                      className="font-medium transition hover:text-blue-700 hover:underline"
                    >
                      {item.title}
                    </Link>

                    <div className="mt-1 text-xs text-amber-700">
                      <TaskDueAt
                        value={
                          item.reminderAt.toISOString()
                        }
                      />
                    </div>
                  </div>

                  {permissions.has(
                    "tasks.update",
                  ) && (
                    <OrganizationForm
                      action={
                        dismissTaskReminder
                      }
                    >
                      <input
                        type="hidden"
                        name="taskId"
                        value={item.id}
                      />
                      <input
                        type="hidden"
                        name="scheduleVersion"
                        value={
                          item.scheduleVersion
                        }
                      />
                      <input
                        type="hidden"
                        name="returnTo"
                        value="/crm"
                      />

                      <button
                        type="submit"
                        className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 transition hover:bg-amber-100"
                      >
                        Скрыть
                      </button>
                    </OrganizationForm>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

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
                      <div className="min-w-0">
                        <Link
                          href={`/crm/tasks/${task.id}`}
                          className="font-medium transition hover:text-blue-700 hover:underline"
                        >
                          {task.title}
                        </Link>

                        <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                          <span>
                            {task.priority ===
                            "urgent"
                              ? "Срочный"
                              : task.priority ===
                                  "high"
                                ? "Высокий приоритет"
                                : task.priority ===
                                    "low"
                                  ? "Низкий приоритет"
                                  : "Обычный приоритет"}
                          </span>

                          {isOverdue && (
                            <span className="font-medium text-red-600">
                              Просрочена
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
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

                        {permissions.has(
                          "tasks.update",
                        ) && (
                          <OrganizationForm
                            action={
                              completeTask
                            }
                          >
                            <input
                              type="hidden"
                              name="taskId"
                              value={task.id}
                            />
                            <input
                              type="hidden"
                              name="version"
                              value={
                                task.version
                              }
                            />
                            <input
                              type="hidden"
                              name="returnTo"
                              value="/crm"
                            />

                            <button
                              type="submit"
                              className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100"
                            >
                              Выполнить
                            </button>
                          </OrganizationForm>
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

function TaskSummaryCard({
  label,
  value,
  href,
  danger = false,
}: {
  label: string;
  value: number;
  href: string;
  danger?: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        danger
          ? "rounded-lg border border-red-200 bg-red-50 p-4 transition hover:bg-red-100"
          : "rounded-lg border border-slate-200 bg-slate-50 p-4 transition hover:bg-slate-100"
      }
    >
      <div
        className={
          danger
            ? "text-sm text-red-700"
            : "text-sm text-slate-500"
        }
      >
        {label}
      </div>

      <div
        className={
          danger
            ? "mt-2 text-2xl font-bold text-red-800"
            : "mt-2 text-2xl font-bold"
        }
      >
        {value}
      </div>
    </Link>
  );
}
