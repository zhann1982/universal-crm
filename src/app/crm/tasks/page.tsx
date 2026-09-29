import {
  and,
  count,
  desc,
  eq,
  gte,
  isNull,
  lt,
  notInArray,
} from "drizzle-orm";
import Link from "next/link";
import {
  redirect,
} from "next/navigation";

import { db } from "@/db";
import {
  organizationMembers,
  tasks,
} from "@/db/schema";
import {
  requirePermission,
} from "@/lib/auth/permissions";
import {
  taskListQuerySchema,
  type TaskListQuery,
} from "@/lib/validation/task";

import {
  TaskDueAt,
} from "./task-due-at";

type SearchParams = {
  [key: string]:
    | string
    | string[]
    | undefined;
};

const PAGE_SIZE = 25;

const statusLabels: Record<
  string,
  string
> = {
  todo: "К выполнению",
  in_progress: "В работе",
  completed: "Выполнена",
  cancelled: "Отменена",
};

const priorityLabels: Record<
  string,
  string
> = {
  low: "Низкий",
  normal: "Обычный",
  high: "Высокий",
  urgent: "Срочный",
};

export default async function TasksPage({
  searchParams,
}: {
  searchParams:
    Promise<SearchParams>;
}) {
  const rawSearchParams =
    await searchParams;

  const query =
    taskListQuerySchema.parse({
      view:
        rawSearchParams.view,
      page:
        rawSearchParams.page,
    });

  const {
    view,
    page,
  } = query;

  const {
    organization,
    member,
    permissions,
  } = await requirePermission(
    "tasks.read",
  );

  const now = new Date();

  const activeStatusCondition =
    notInArray(
      tasks.status,
      [
        "completed",
        "cancelled",
      ],
    );

  const viewCondition =
    view === "mine"
      ? and(
          eq(
            tasks.ownerMemberId,
            member.id,
          ),
          activeStatusCondition,
        )
      : view === "overdue"
        ? and(
            lt(
              tasks.dueAt,
              now,
            ),
            activeStatusCondition,
          )
        : view === "upcoming"
          ? and(
              gte(
                tasks.dueAt,
                now,
              ),
              activeStatusCondition,
            )
          : view === "completed"
            ? eq(
                tasks.status,
                "completed",
              )
            : undefined;

  const whereCondition = and(
    eq(
      tasks.organizationId,
      organization.id,
    ),
    eq(
      tasks.isArchived,
      view === "archive",
    ),
    isNull(
      tasks.deletedAt,
    ),
    viewCondition,
  );

  const [countResult] =
    await db
      .select({
        total: count(),
      })
      .from(tasks)
      .where(
        whereCondition,
      );

  const totalTasks =
    countResult.total;

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        totalTasks /
          PAGE_SIZE,
      ),
    );

  const currentPage =
    Math.min(
      page,
      totalPages,
    );

  if (
    page !== currentPage
  ) {
    redirect(
      buildTasksHref({
        view,
        page:
          currentPage,
      }),
    );
  }

  const offset =
    (currentPage - 1) *
    PAGE_SIZE;

  const taskRows =
    permissions.has(
      "members.read",
    )
      ? await db
          .select({
            id:
              tasks.id,
            title:
              tasks.title,
            status:
              tasks.status,
            priority:
              tasks.priority,
            dueAt:
              tasks.dueAt,
            ownerMemberId:
              tasks.ownerMemberId,
            ownerDisplayName:
              organizationMembers.displayName,
            createdAt:
              tasks.createdAt,
          })
          .from(tasks)
          .leftJoin(
            organizationMembers,
            eq(
              tasks.ownerMemberId,
              organizationMembers.id,
            ),
          )
          .where(
            whereCondition,
          )
          .orderBy(
            desc(
              tasks.createdAt,
            ),
          )
          .limit(PAGE_SIZE)
          .offset(offset)
      : (
          await db
            .select({
              id:
                tasks.id,
              title:
                tasks.title,
              status:
                tasks.status,
              priority:
                tasks.priority,
              dueAt:
                tasks.dueAt,
              ownerMemberId:
                tasks.ownerMemberId,
              createdAt:
                tasks.createdAt,
            })
            .from(tasks)
            .where(
              whereCondition,
            )
            .orderBy(
              desc(
                tasks.createdAt,
              ),
            )
            .limit(PAGE_SIZE)
            .offset(offset)
        ).map((task) => ({
          ...task,
          ownerDisplayName:
            task.ownerMemberId ===
            member.id
              ? member.displayName
              : task.ownerMemberId
                ? "Сотрудник"
                : null,
        }));

  const previousHref =
    currentPage > 1
      ? buildTasksHref({
          view,
          page:
            currentPage - 1,
        })
      : null;

  const nextHref =
    currentPage < totalPages
      ? buildTasksHref({
          view,
          page:
            currentPage + 1,
        })
      : null;

  const firstVisible =
    totalTasks === 0
      ? 0
      : offset + 1;

  const lastVisible =
    Math.min(
      offset +
        taskRows.length,
      totalTasks,
    );

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">
            Задачи
          </h1>

          <p className="mt-2 text-slate-500">
            {view === "archive"
              ? "Архив задач"
              : "Рабочие задачи CRM"}
            : {totalTasks}
          </p>
        </div>

        {permissions.has(
          "tasks.create",
        ) && (
          <Link
            href="/crm/tasks/new"
            className="rounded-lg bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            + Новая задача
          </Link>
        )}
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <TaskViewLink
          href="/crm/tasks"
          active={
            view === "all"
          }
        >
          Все
        </TaskViewLink>

        <TaskViewLink
          href="/crm/tasks?view=mine"
          active={
            view === "mine"
          }
        >
          Мои
        </TaskViewLink>

        <TaskViewLink
          href="/crm/tasks?view=overdue"
          active={
            view === "overdue"
          }
        >
          Просроченные
        </TaskViewLink>

        <TaskViewLink
          href="/crm/tasks?view=upcoming"
          active={
            view === "upcoming"
          }
        >
          Предстоящие
        </TaskViewLink>

        <TaskViewLink
          href="/crm/tasks?view=completed"
          active={
            view === "completed"
          }
        >
          Выполненные
        </TaskViewLink>

        <TaskViewLink
          href="/crm/tasks?view=archive"
          active={
            view === "archive"
          }
        >
          Архив
        </TaskViewLink>
      </div>

      {taskRows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          <h2 className="text-lg font-semibold">
            Задач пока нет
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Создайте первую задачу
            или выберите другой
            фильтр.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <TableHead>
                    Задача
                  </TableHead>
                  <TableHead>
                    Статус
                  </TableHead>
                  <TableHead>
                    Приоритет
                  </TableHead>
                  <TableHead>
                    Ответственный
                  </TableHead>
                  <TableHead>
                    Срок
                  </TableHead>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {taskRows.map(
                  (task) => {
                    const isOverdue =
                      Boolean(
                        task.dueAt &&
                          task.dueAt < now &&
                          task.status !==
                            "completed" &&
                          task.status !==
                            "cancelled",
                      );

                    const rowClassName =
                      isOverdue
                        ? "bg-red-50/60 transition hover:bg-red-50"
                        : task.priority ===
                            "urgent"
                          ? "bg-amber-50/50 transition hover:bg-amber-50"
                          : "transition hover:bg-slate-50";

                    return (
                      <tr
                        key={task.id}
                        className={
                          rowClassName
                        }
                      >
                        <td className="px-5 py-4">
                          <Link
                            href={`/crm/tasks/${task.id}`}
                            className="font-medium text-slate-950 transition hover:text-blue-700 hover:underline"
                          >
                            {task.title}
                          </Link>

                          <div className="mt-1 text-xs text-slate-400">
                            {isOverdue
                              ? "Просрочена"
                              : task.id}
                          </div>
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-700">
                          {statusLabels[
                            task.status
                          ] ??
                            task.status}
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-700">
                          {priorityLabels[
                            task.priority
                          ] ??
                            task.priority}
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-700">
                          {task.ownerDisplayName ||
                            "—"}
                        </td>

                        <td
                          className={
                            isOverdue
                              ? "px-5 py-4 text-sm font-medium text-red-700"
                              : "px-5 py-4 text-sm text-slate-700"
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
                        </td>
                      </tr>
                    );
                  },
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-4 text-sm text-slate-500">
        <div>
          Показано {firstVisible}–{lastVisible} из {totalTasks}
        </div>

        <div className="flex gap-2">
          {previousHref ? (
            <Link
              href={previousHref}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-medium text-slate-700 transition hover:bg-slate-50"
            >
              ← Назад
            </Link>
          ) : (
            <span className="cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 px-4 py-2 text-slate-400">
              ← Назад
            </span>
          )}

          {nextHref ? (
            <Link
              href={nextHref}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Далее →
            </Link>
          ) : (
            <span className="cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 px-4 py-2 text-slate-400">
              Далее →
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function buildTasksHref({
  view,
  page,
}: TaskListQuery) {
  const params =
    new URLSearchParams();

  if (view !== "all") {
    params.set(
      "view",
      view,
    );
  }

  if (page > 1) {
    params.set(
      "page",
      String(page),
    );
  }

  const query =
    params.toString();

  return query
    ? `/crm/tasks?${query}`
    : "/crm/tasks";
}

function TaskViewLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? "rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white"
          : "rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
      }
    >
      {children}
    </Link>
  );
}

function TableHead({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <th
      scope="col"
      className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
    >
      {children}
    </th>
  );
}
