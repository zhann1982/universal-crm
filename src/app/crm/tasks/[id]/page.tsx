import {
  and,
  eq,
  isNull,
} from "drizzle-orm";
import Link from "next/link";
import {
  notFound,
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
  taskIdSchema,
} from "@/lib/validation/task";

import {
  archiveTask,
  completeTask,
  reopenTask,
  restoreTask,
} from "../actions";
import {
  TaskDueAt,
} from "../task-due-at";

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

type SearchParams = {
  [key: string]:
    | string
    | string[]
    | undefined;
};

export default async function TaskPage({
  params,
  searchParams,
}: {
  params: Promise<{
    id: string;
  }>;
  searchParams:
    Promise<SearchParams>;
}) {
  const {
    organization,
    member,
    permissions,
  } = await requirePermission(
    "tasks.read",
  );

  const { id } = await params;
  const rawSearchParams =
    await searchParams;

  const idResult =
    taskIdSchema.safeParse(id);

  if (!idResult.success) {
    notFound();
  }

  const [task] =
    await db
      .select({
        id: tasks.id,
        ownerMemberId:
          tasks.ownerMemberId,
        createdByMemberId:
          tasks.createdByMemberId,
        clientId:
          tasks.clientId,
        companyId:
          tasks.companyId,
        dealId:
          tasks.dealId,
        title: tasks.title,
        description:
          tasks.description,
        status: tasks.status,
        priority:
          tasks.priority,
        dueAt: tasks.dueAt,
        completedAt:
          tasks.completedAt,
        isArchived:
          tasks.isArchived,
        version: tasks.version,
        createdAt:
          tasks.createdAt,
        updatedAt:
          tasks.updatedAt,
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

  let ownerLabel =
    task.ownerMemberId
      ? task.ownerMemberId ===
        member.id
        ? member.displayName ||
          "Я"
        : "Сотрудник"
      : "—";

  let creatorLabel =
    task.createdByMemberId
      ? task.createdByMemberId ===
        member.id
        ? member.displayName ||
          "Я"
        : "Сотрудник"
      : "—";

  if (
    permissions.has(
      "members.read",
    )
  ) {
    if (task.ownerMemberId) {
      const [owner] =
        await db
          .select({
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

      ownerLabel =
        owner?.displayName ||
        "Сотрудник";
    }

    if (
      task.createdByMemberId
    ) {
      const [creator] =
        await db
          .select({
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
                task.createdByMemberId,
              ),
              eq(
                organizationMembers.organizationId,
                organization.id,
              ),
            ),
          )
          .limit(1);

      creatorLabel =
        creator?.displayName ||
        "Сотрудник";
    }
  }

  const client =
    task.clientId &&
    permissions.has(
      "clients.read",
    )
      ? (
          await db
            .select({
              id: clients.id,
              firstName:
                clients.firstName,
              lastName:
                clients.lastName,
              phone:
                clients.phone,
              isArchived:
                clients.isArchived,
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
            .limit(1)
        )[0]
      : undefined;

  const company =
    task.companyId &&
    permissions.has(
      "companies.read",
    )
      ? (
          await db
            .select({
              id: companies.id,
              name: companies.name,
              isArchived:
                companies.isArchived,
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
            .limit(1)
        )[0]
      : undefined;

  const deal =
    task.dealId &&
    permissions.has(
      "deals.read",
    )
      ? (
          await db
            .select({
              id: deals.id,
              title: deals.title,
              isArchived:
                deals.isArchived,
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
            .limit(1)
        )[0]
      : undefined;

  const now = new Date();
  const isOverdue = Boolean(
    task.dueAt &&
      task.dueAt < now &&
      task.status !==
        "completed" &&
      task.status !==
        "cancelled",
  );

  const rawError =
    rawSearchParams.error;

  const error =
    Array.isArray(rawError)
      ? rawError[0]
      : rawError;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8">
        <Link
          href={
            task.isArchived
              ? "/crm/tasks?view=archive"
              : "/crm/tasks"
          }
          className="text-sm text-slate-500 transition hover:text-slate-900"
        >
          ← Назад к задачам
        </Link>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-bold">
                {task.title}
              </h1>

              {task.isArchived && (
                <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-medium text-slate-700">
                  Архив
                </span>
              )}

              {isOverdue && (
                <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700">
                  Просрочена
                </span>
              )}
            </div>

            <p className="mt-2 text-sm text-slate-500">
              Версия {task.version}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {!task.isArchived &&
              permissions.has(
                "tasks.update",
              ) && (
                <Link
                  href={`/crm/tasks/${task.id}/edit`}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Редактировать
                </Link>
              )}

            {!task.isArchived &&
              permissions.has(
                "tasks.update",
              ) &&
              task.status !==
                "completed" && (
                <TaskMutationForm
                  action={
                    completeTask
                  }
                  taskId={task.id}
                  version={
                    task.version
                  }
                  label="Выполнить"
                  className="bg-emerald-600 text-white hover:bg-emerald-500"
                />
              )}

            {!task.isArchived &&
              permissions.has(
                "tasks.update",
              ) &&
              task.status ===
                "completed" && (
                <TaskMutationForm
                  action={
                    reopenTask
                  }
                  taskId={task.id}
                  version={
                    task.version
                  }
                  label="Вернуть в работу"
                  className="bg-blue-600 text-white hover:bg-blue-500"
                />
              )}

            {!task.isArchived &&
              permissions.has(
                "tasks.archive",
              ) && (
                <TaskMutationForm
                  action={archiveTask}
                  taskId={task.id}
                  version={
                    task.version
                  }
                  label="Архивировать"
                  className="bg-slate-800 text-white hover:bg-slate-700"
                />
              )}

            {task.isArchived &&
              permissions.has(
                "tasks.archive",
              ) && (
                <TaskMutationForm
                  action={restoreTask}
                  taskId={task.id}
                  version={
                    task.version
                  }
                  label="Восстановить"
                  className="bg-slate-950 text-white hover:bg-slate-800"
                />
              )}
          </div>
        </div>
      </div>

      {error === "conflict" && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Задача уже была изменена другим действием. Обновите страницу и повторите операцию.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">
              Описание
            </h2>

            <div className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">
              {task.description ||
                "Описание не указано."}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">
              Связи CRM
            </h2>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <RelationCard
                label="Клиент"
                value={
                  task.clientId
                    ? client
                      ? [
                          client.lastName,
                          client.firstName,
                        ]
                          .filter(Boolean)
                          .join(" ") ||
                        client.phone ||
                        "Клиент"
                      : permissions.has(
                            "clients.read",
                          )
                        ? "Недоступен"
                        : "Связь скрыта"
                    : "—"
                }
                href={
                  client
                    ? `/crm/clients/${client.id}`
                    : undefined
                }
                archived={
                  client?.isArchived
                }
              />

              <RelationCard
                label="Компания"
                value={
                  task.companyId
                    ? company
                      ? company.name
                      : permissions.has(
                            "companies.read",
                          )
                        ? "Недоступна"
                        : "Связь скрыта"
                    : "—"
                }
                href={
                  company
                    ? `/crm/companies/${company.id}`
                    : undefined
                }
                archived={
                  company?.isArchived
                }
              />

              <RelationCard
                label="Сделка"
                value={
                  task.dealId
                    ? deal
                      ? deal.title
                      : permissions.has(
                            "deals.read",
                          )
                        ? "Недоступна"
                        : "Связь скрыта"
                    : "—"
                }
                href={
                  deal
                    ? `/crm/deals/${deal.id}`
                    : undefined
                }
                archived={
                  deal?.isArchived
                }
              />
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">
              Параметры
            </h2>

            <dl className="mt-5 space-y-4 text-sm">
              <DetailRow
                label="Статус"
                value={
                  statusLabels[
                    task.status
                  ] ?? task.status
                }
              />

              <DetailRow
                label="Приоритет"
                value={
                  priorityLabels[
                    task.priority
                  ] ?? task.priority
                }
              />

              <DetailRow
                label="Ответственный"
                value={ownerLabel}
              />

              <DetailRow
                label="Создал"
                value={creatorLabel}
              />

              <DetailRow
                label="Срок"
                value={
                  task.dueAt ? (
                    <TaskDueAt
                      value={
                        task.dueAt.toISOString()
                      }
                    />
                  ) : (
                    "—"
                  )
                }
                danger={isOverdue}
              />

              <DetailRow
                label="Выполнена"
                value={
                  task.completedAt ? (
                    <TaskDueAt
                      value={
                        task.completedAt.toISOString()
                      }
                    />
                  ) : (
                    "—"
                  )
                }
              />
            </dl>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">
              История записи
            </h2>

            <dl className="mt-5 space-y-4 text-sm">
              <DetailRow
                label="Создана"
                value={
                  <TaskDueAt
                    value={
                      task.createdAt.toISOString()
                    }
                  />
                }
              />

              <DetailRow
                label="Изменена"
                value={
                  <TaskDueAt
                    value={
                      task.updatedAt.toISOString()
                    }
                  />
                }
              />
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}

function TaskMutationForm({
  action,
  taskId,
  version,
  label,
  className,
}: {
  action: (
    formData: FormData,
  ) => Promise<void>;
  taskId: string;
  version: number;
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

      <button
        type="submit"
        className={`rounded-lg px-4 py-2 text-sm font-medium transition ${className}`}
      >
        {label}
      </button>
    </form>
  );
}

function RelationCard({
  label,
  value,
  href,
  archived,
}: {
  label: string;
  value: string;
  href?: string;
  archived?: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>

      <div className="mt-2 text-sm font-medium text-slate-900">
        {href ? (
          <Link
            href={href}
            className="transition hover:text-blue-700 hover:underline"
          >
            {value}
          </Link>
        ) : (
          value
        )}
      </div>

      {archived && (
        <div className="mt-2 text-xs text-slate-500">
          В архиве
        </div>
      )}
    </div>
  );
}

function DetailRow({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">
        {label}
      </dt>

      <dd
        className={
          danger
            ? "mt-1 font-medium text-red-700"
            : "mt-1 text-slate-800"
        }
      >
        {value}
      </dd>
    </div>
  );
}
