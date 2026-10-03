import { OrganizationForm } from "@/modules/access/organization-context";
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
  lte,
  notInArray,
  or,
  sql,
} from "drizzle-orm";
import Link from "@/components/app-link";
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
  taskSchedules,
} from "@/db/task-scheduling-schema";
import {
  taskListQuerySchema,
  type TaskListQuery,
} from "@/lib/validation/task";

import {
  archiveTask,
  bulkTaskAction,
  completeTask,
  dismissTaskReminder,
  reopenTask,
  restoreTask,
} from "./actions";
import {
  TaskDueAt,
} from "./task-due-at";
import {
  TaskSelectAllButtons,
} from "./task-select-all-buttons";

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
      sort:
        rawSearchParams.sort,
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
    sort,
    page,
  } = normalizedQuery;

  const now = new Date();

  const priorityRank =
    sql<number>`case
      when ${tasks.priority} = 'urgent' then 4
      when ${tasks.priority} = 'high' then 3
      when ${tasks.priority} = 'normal' then 2
      when ${tasks.priority} = 'low' then 1
      else 0
    end`;

  const taskOrderBy =
    sort === "created_asc"
      ? [
          asc(tasks.createdAt),
          asc(tasks.id),
        ]
      : sort === "due_asc"
        ? [
            sql`${tasks.dueAt} asc nulls last`,
            desc(tasks.createdAt),
          ]
        : sort === "due_desc"
          ? [
              sql`${tasks.dueAt} desc nulls last`,
              desc(tasks.createdAt),
            ]
          : sort === "priority_desc"
            ? [
                desc(priorityRank),
                desc(tasks.createdAt),
              ]
            : sort === "priority_asc"
              ? [
                  asc(priorityRank),
                  desc(tasks.createdAt),
                ]
              : sort === "title_asc"
                ? [
                    asc(tasks.title),
                    desc(tasks.createdAt),
                  ]
                : sort === "title_desc"
                  ? [
                      desc(tasks.title),
                      desc(tasks.createdAt),
                    ]
                  : [
                      desc(tasks.createdAt),
                      desc(tasks.id),
                    ];

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
          : view === "reminders"
            ? and(
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
      .leftJoin(
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
            reminderAt:
              taskSchedules.reminderAt,
            reminderDismissedAt:
              taskSchedules.reminderDismissedAt,
            recurrenceFrequency:
              taskSchedules.recurrenceFrequency,
            recurrenceInterval:
              taskSchedules.recurrenceInterval,
            scheduleVersion:
              taskSchedules.version,
          })
          .from(tasks)
          .leftJoin(
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
            ...taskOrderBy,
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
              reminderAt:
                taskSchedules.reminderAt,
              reminderDismissedAt:
                taskSchedules.reminderDismissedAt,
              recurrenceFrequency:
                taskSchedules.recurrenceFrequency,
              recurrenceInterval:
                taskSchedules.recurrenceInterval,
              scheduleVersion:
                taskSchedules.version,
            })
            .from(tasks)
            .leftJoin(
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
              whereCondition,
            )
            .orderBy(
              ...taskOrderBy,
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

  const rawBulk =
    rawSearchParams.bulk;

  const bulk =
    Array.isArray(rawBulk)
      ? rawBulk[0]
      : rawBulk;

  const rawUpdated =
    rawSearchParams.updated;

  const updatedCount =
    Number(
      Array.isArray(rawUpdated)
        ? rawUpdated[0]
        : rawUpdated,
    ) || 0;

  const rawConflicts =
    rawSearchParams.conflicts;

  const conflictCount =
    Number(
      Array.isArray(rawConflicts)
        ? rawConflicts[0]
        : rawConflicts,
    ) || 0;

  const canBulkUpdate =
    permissions.has(
      "tasks.update",
    );

  const canBulkArchive =
    permissions.has(
      "tasks.archive",
    );

  const showBulkActions =
    taskRows.length > 0 &&
    (
      canBulkUpdate ||
      canBulkArchive
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
              : view === "reminders"
                ? "Сработавшие напоминания"
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

      {bulk === "no-selection" && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Выберите хотя бы одну задачу для массового действия.
        </div>
      )}

      {bulk === "done" && (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Массовое действие выполнено. Обновлено: {updatedCount}.
          {conflictCount > 0
            ? ` Конфликтов или пропущенных задач: ${conflictCount}.`
            : ""}
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
          href="/crm/tasks?view=reminders"
          active={
            view === "reminders"
          }
        >
          Напоминания
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

      <OrganizationForm
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

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-7">
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

          <FilterSelect
            label="Сортировка"
            name="sort"
            value={sort}
            options={[
              ["created_desc", "Сначала новые"],
              ["created_asc", "Сначала старые"],
              ["due_asc", "Срок: ближайшие"],
              ["due_desc", "Срок: поздние"],
              ["priority_desc", "Приоритет: высокий"],
              ["priority_asc", "Приоритет: низкий"],
              ["title_asc", "Название: А–Я"],
              ["title_desc", "Название: Я–А"],
            ]}
          />
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
                  sort: "created_desc",
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
      </OrganizationForm>

      {showBulkActions && (
        <OrganizationForm
          id="task-bulk-form"
          action={bulkTaskAction}
          className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
        >
          <input
            type="hidden"
            name="returnTo"
            value={currentListHref}
          />

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-slate-700">
              Массовые действия
            </span>

            <TaskSelectAllButtons />
          </div>

          <div className="flex flex-wrap gap-2">
            {view !== "archive" &&
              canBulkUpdate && (
                <>
                  <BulkActionButton
                    value="todo"
                    label="К выполнению"
                  />
                  <BulkActionButton
                    value="in_progress"
                    label="В работу"
                  />
                  <BulkActionButton
                    value="complete"
                    label="Выполнить"
                    emphasis="success"
                  />
                  <BulkActionButton
                    value="cancel"
                    label="Отменить"
                  />
                </>
              )}

            {view !== "archive" &&
              canBulkArchive && (
                <BulkActionButton
                  value="archive"
                  label="В архив"
                />
              )}

            {view === "archive" &&
              canBulkArchive && (
                <BulkActionButton
                  value="restore"
                  label="Восстановить"
                  emphasis="dark"
                />
              )}
          </div>
        </OrganizationForm>
      )}

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
                  {showBulkActions && (
                    <TableHead>
                      Выбор
                    </TableHead>
                  )}

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
                    Планирование
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

                    const reminderDue =
                      Boolean(
                        task.reminderAt &&
                          task.reminderAt <= now &&
                          !task.reminderDismissedAt &&
                          task.status !==
                            "completed" &&
                          task.status !==
                            "cancelled",
                      );

                    const recurrenceLabel =
                      task.recurrenceFrequency &&
                      task.recurrenceFrequency !==
                        "none"
                        ? formatRecurrence(
                            task.recurrenceFrequency,
                            task.recurrenceInterval ??
                              1,
                          )
                        : null;

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
                        {showBulkActions && (
                          <td className="px-5 py-4 align-top">
                            <input
                              type="checkbox"
                              name="taskIds"
                              value={task.id}
                              form="task-bulk-form"
                              data-task-select="true"
                              aria-label={`Выбрать задачу ${task.title}`}
                              className="h-4 w-4 rounded border-slate-300"
                            />

                            <input
                              type="hidden"
                              name={`version:${task.id}`}
                              value={task.version}
                              form="task-bulk-form"
                            />
                          </td>
                        )}

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

                        <td className="px-5 py-4 text-xs text-slate-600">
                          <div className="min-w-40 space-y-1.5">
                            {task.reminderAt ? (
                              <div
                                className={
                                  reminderDue
                                    ? "font-medium text-amber-700"
                                    : "text-slate-500"
                                }
                              >
                                Напомнить: {" "}
                                <TaskDueAt
                                  value={
                                    task.reminderAt.toISOString()
                                  }
                                />
                              </div>
                            ) : (
                              <div className="text-slate-400">
                                Без напоминания
                              </div>
                            )}

                            {recurrenceLabel && (
                              <div className="font-medium text-blue-700">
                                {recurrenceLabel}
                              </div>
                            )}
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex min-w-56 flex-wrap gap-2">
                            {reminderDue &&
                              permissions.has(
                                "tasks.update",
                              ) &&
                              task.scheduleVersion && (
                                <ReminderDismissForm
                                  taskId={task.id}
                                  scheduleVersion={
                                    task.scheduleVersion
                                  }
                                  returnTo={
                                    currentListHref
                                  }
                                />
                              )}
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
  sort,
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

  if (
    sort !== "created_desc"
  ) {
    params.set(
      "sort",
      sort,
    );
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

function ReminderDismissForm({
  taskId,
  scheduleVersion,
  returnTo,
}: {
  taskId: string;
  scheduleVersion: number;
  returnTo: string;
}) {
  return (
    <OrganizationForm
      action={
        dismissTaskReminder
      }
    >
      <input
        type="hidden"
        name="taskId"
        value={taskId}
      />
      <input
        type="hidden"
        name="scheduleVersion"
        value={scheduleVersion}
      />
      <input
        type="hidden"
        name="returnTo"
        value={returnTo}
      />

      <button
        type="submit"
        className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-800 transition hover:bg-amber-100"
      >
        Скрыть напоминание
      </button>
    </OrganizationForm>
  );
}

function formatRecurrence(
  frequency: string,
  interval: number,
) {
  const unit =
    frequency === "daily"
      ? "дн."
      : frequency === "weekly"
        ? "нед."
        : frequency === "monthly"
          ? "мес."
          : "г.";

  return interval === 1
    ? frequency === "daily"
      ? "Повтор: ежедневно"
      : frequency === "weekly"
        ? "Повтор: еженедельно"
        : frequency === "monthly"
          ? "Повтор: ежемесячно"
          : "Повтор: ежегодно"
    : `Повтор: каждые ${interval} ${unit}`;
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
    <OrganizationForm action={action}>
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
    </OrganizationForm>
  );
}

function BulkActionButton({
  value,
  label,
  emphasis = "default",
}: {
  value:
    | "todo"
    | "in_progress"
    | "complete"
    | "cancel"
    | "archive"
    | "restore";
  label: string;
  emphasis?:
    | "default"
    | "success"
    | "dark";
}) {
  const className =
    emphasis === "success"
      ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
      : emphasis === "dark"
        ? "border-slate-900 bg-slate-900 text-white hover:bg-slate-700"
        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100";

  return (
    <button
      type="submit"
      name="bulkAction"
      value={value}
      className={`rounded-md border px-3 py-2 text-xs font-medium transition ${className}`}
    >
      {label}
    </button>
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
