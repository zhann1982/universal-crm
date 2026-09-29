import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  isNotNull,
  isNull,
  lt,
  notInArray,
  or,
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
  archiveTask,
  completeTask,
  reopenTask,
  restoreTask,
} from "./actions";
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
      status:
        rawSearchParams.status,
      priority:
        rawSearchParams.priority,
      due:
        rawSearchParams.due,
      owner:
        rawSearchParams.owner,
      q:
        rawSearchParams.q,
      page:
        rawSearchParams.page,
    });

  const {
    organization,
    member,
    permissions,
  } = await requirePermission(
    "tasks.read",
  );

  const canReadMembers =
    permissions.has(
      "members.read",
    );

  const memberOptions =
    canReadMembers
      ? await db
          .select({
            id:
              organizationMembers.id,
            displayName:
              organizationMembers.displayName,
            status:
              organizationMembers.status,
          })
          .from(
            organizationMembers,
          )
          .where(
            eq(
              organizationMembers.organizationId,
              organization.id,
            ),
          )
          .orderBy(
            asc(
              organizationMembers.displayName,
            ),
          )
      : [];

  const effectiveOwner =
    query.owner === "any" ||
    query.owner === "mine" ||
    query.owner ===
      "unassigned"
      ? query.owner
      : canReadMembers &&
          memberOptions.some(
            (item) =>
              item.id ===
              query.owner,
          )
        ? query.owner
        : "any";

  const normalizedQuery: TaskListQuery = {
    ...query,
    owner:
      effectiveOwner,
  };

  const {
    view,
    status,
    priority,
    due,
    q,
    page,
  } = normalizedQuery;

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
            isNotNull(
              tasks.dueAt,
            ),
            lt(
              tasks.dueAt,
              now,
            ),
            activeStatusCondition,
          )
        : view === "upcoming"
          ? and(
              isNotNull(
                tasks.dueAt,
              ),
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

  const statusCondition =
    status === "any"
      ? undefined
      : eq(
          tasks.status,
          status,
        );

  const priorityCondition =
    priority === "any"
      ? undefined
      : eq(
          tasks.priority,
          priority,
        );

  const dueCondition =
    due === "overdue"
      ? and(
          isNotNull(
            tasks.dueAt,
          ),
          lt(
            tasks.dueAt,
            now,
          ),
        )
      : due === "upcoming"
        ? and(
            isNotNull(
              tasks.dueAt,
            ),
            gte(
              tasks.dueAt,
              now,
            ),
          )
        : due === "none"
          ? isNull(
              tasks.dueAt,
            )
          : undefined;

  const ownerCondition =
    effectiveOwner === "mine"
      ? eq(
          tasks.ownerMemberId,
          member.id,
        )
      : effectiveOwner ===
          "unassigned"
        ? isNull(
            tasks.ownerMemberId,
          )
        : effectiveOwner ===
            "any"
          ? undefined
          : eq(
              tasks.ownerMemberId,
              effectiveOwner,
            );

  const searchCondition = q
    ? or(
        ilike(
          tasks.title,
          `%${q}%`,
        ),
        ilike(
          tasks.description,
          `%${q}%`,
        ),
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
    statusCondition,
    priorityCondition,
    dueCondition,
    ownerCondition,
    searchCondition,
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
        ...normalizedQuery,
        page:
          currentPage,
      }),
    );
  }

  const offset =
    (currentPage - 1) *
    PAGE_SIZE;

  const taskRows =
    canReadMembers
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
            version:
              tasks.version,
            isArchived:
              tasks.isArchived,
          })
          .from(tasks)
          .leftJoin(
            organizationMembers,
            and(
              eq(
                tasks.ownerMemberId,
                organizationMembers.id,
              ),
              eq(
                organizationMembers.organizationId,
                organization.id,
              ),
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
              version:
                tasks.version,
              isArchived:
                tasks.isArchived,
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

  const currentListHref =
    buildTasksHref({
      ...normalizedQuery,
      page:
        currentPage,
    });

  const previousHref =
    currentPage > 1
      ? buildTasksHref({
          ...normalizedQuery,
          page:
            currentPage - 1,
        })
      : null;

  const nextHref =
    currentPage < totalPages
      ? buildTasksHref({
          ...normalizedQuery,
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

  const rawError =
    rawSearchParams.error;

  const error =
    Array.isArray(rawError)
      ? rawError[0]
      : rawError;

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

      {error === "conflict" && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Задача уже была изменена другим действием. Список обновлён — при необходимости повторите операцию.
        </div>
      )}

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

      <form
        method="get"
        action="/crm/tasks"
        className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        {view !== "all" && (
          <input
            type="hidden"
            name="view"
            value={view}
          />
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <div className="xl:col-span-2">
            <label
              htmlFor="q"
              className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500"
            >
              Поиск
            </label>

            <input
              id="q"
              name="q"
              defaultValue={q}
              placeholder="Название или описание"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500"
            />
          </div>

          <FilterSelect
            label="Статус"
            name="status"
            value={status}
            options={[
              ["any", "Все"],
              ["todo", "К выполнению"],
              ["in_progress", "В работе"],
              ["completed", "Выполнена"],
              ["cancelled", "Отменена"],
            ]}
          />

          <FilterSelect
            label="Приоритет"
            name="priority"
            value={priority}
            options={[
              ["any", "Все"],
              ["low", "Низкий"],
              ["normal", "Обычный"],
              ["high", "Высокий"],
              ["urgent", "Срочный"],
            ]}
          />

          <FilterSelect
            label="Срок"
            name="due"
            value={due}
            options={[
              ["any", "Любой"],
              ["overdue", "Просрочен"],
              ["upcoming", "Предстоящий"],
              ["none", "Без срока"],
            ]}
          />

          <div>
            <label
              htmlFor="owner"
              className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500"
            >
              Ответственный
            </label>

            <select
              id="owner"
              name="owner"
              defaultValue={
                effectiveOwner
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-500"
            >
              <option value="any">
                Все
              </option>
              <option value="mine">
                Мои
              </option>
              <option value="unassigned">
                Без ответственного
              </option>

              {memberOptions.map(
                (item) => (
                  <option
                    key={item.id}
                    value={item.id}
                  >
                    {item.displayName ||
                      "Сотрудник"}
                    {item.status !==
                    "active"
                      ? " (неактивен)"
                      : ""}
                  </option>
                ),
              )}
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            Найдено: {totalTasks}
          </div>

          <div className="flex gap-2">
            <Link
              href={
                buildTasksHref({
                  view,
                  status: "any",
                  priority: "any",
                  due: "any",
                  owner: "any",
                  q: "",
                  page: 1,
                })
              }
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Сбросить
            </Link>

            <button
              type="submit"
              className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Применить
            </button>
          </div>
        </div>
      </form>

      {taskRows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          <h2 className="text-lg font-semibold">
            Задачи не найдены
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Измените фильтры или создайте новую задачу.
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
                  <TableHead>
                    Действия
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

                        <td className="px-5 py-4">
                          <div className="flex min-w-56 flex-wrap gap-2">
                            {!task.isArchived &&
                              permissions.has(
                                "tasks.update",
                              ) && (
                                <Link
                                  href={`/crm/tasks/${task.id}/edit`}
                                  className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                                >
                                  Изменить
                                </Link>
                              )}

                            {!task.isArchived &&
                              permissions.has(
                                "tasks.update",
                              ) &&
                              task.status !==
                                "completed" &&
                              task.status !==
                                "cancelled" && (
                                <TaskActionForm
                                  action={
                                    completeTask
                                  }
                                  taskId={task.id}
                                  version={
                                    task.version
                                  }
                                  returnTo={
                                    currentListHref
                                  }
                                  label="Выполнить"
                                  className="border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                />
                              )}

                            {!task.isArchived &&
                              permissions.has(
                                "tasks.update",
                              ) &&
                              task.status ===
                                "completed" && (
                                <TaskActionForm
                                  action={
                                    reopenTask
                                  }
                                  taskId={task.id}
                                  version={
                                    task.version
                                  }
                                  returnTo={
                                    currentListHref
                                  }
                                  label="Вернуть"
                                  className="border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100"
                                />
                              )}

                            {!task.isArchived &&
                              permissions.has(
                                "tasks.archive",
                              ) && (
                                <TaskActionForm
                                  action={
                                    archiveTask
                                  }
                                  taskId={task.id}
                                  version={
                                    task.version
                                  }
                                  returnTo={
                                    currentListHref
                                  }
                                  label="Архив"
                                  className="border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                                />
                              )}

                            {view === "archive" &&
                              permissions.has(
                                "tasks.archive",
                              ) && (
                                <TaskActionForm
                                  action={
                                    restoreTask
                                  }
                                  taskId={task.id}
                                  version={
                                    task.version
                                  }
                                  returnTo={
                                    currentListHref
                                  }
                                  label="Восстановить"
                                  className="border-slate-900 bg-slate-900 text-white hover:bg-slate-700"
                                />
                              )}
                          </div>
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
  status,
  priority,
  due,
  owner,
  q,
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

  if (status !== "any") {
    params.set(
      "status",
      status,
    );
  }

  if (priority !== "any") {
    params.set(
      "priority",
      priority,
    );
  }

  if (due !== "any") {
    params.set(
      "due",
      due,
    );
  }

  if (owner !== "any") {
    params.set(
      "owner",
      owner,
    );
  }

  if (q) {
    params.set("q", q);
  }

  if (page > 1) {
    params.set(
      "page",
      String(page),
    );
  }

  const queryString =
    params.toString();

  return queryString
    ? `/crm/tasks?${queryString}`
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

function FilterSelect({
  label,
  name,
  value,
  options,
}: {
  label: string;
  name: string;
  value: string;
  options: Array<
    [string, string]
  >;
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500"
      >
        {label}
      </label>

      <select
        id={name}
        name={name}
        defaultValue={value}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-500"
      >
        {options.map(
          ([optionValue, optionLabel]) => (
            <option
              key={optionValue}
              value={optionValue}
            >
              {optionLabel}
            </option>
          ),
        )}
      </select>
    </div>
  );
}

function TaskActionForm({
  action,
  taskId,
  version,
  returnTo,
  label,
  className,
}: {
  action: (
    formData: FormData,
  ) => Promise<void>;
  taskId: string;
  version: number;
  returnTo: string;
  label: string;
  className: string;
}) {
  return (
    <form action={action}>
      <input
        type="hidden"
        name="taskId"
        value={taskId}
      />
      <input
        type="hidden"
        name="version"
        value={version}
      />
      <input
        type="hidden"
        name="returnTo"
        value={returnTo}
      />

      <button
        type="submit"
        className={`rounded-md border px-2.5 py-1.5 text-xs font-medium transition ${className}`}
      >
        {label}
      </button>
    </form>
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
