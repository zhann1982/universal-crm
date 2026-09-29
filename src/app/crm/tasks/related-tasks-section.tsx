import {
  and,
  asc,
  desc,
  eq,
  isNull,
} from "drizzle-orm";
import Link from "next/link";

import { db } from "@/db";
import { tasks } from "@/db/schema";

import { TaskDueAt } from "./task-due-at";

type RelationType =
  | "client"
  | "company"
  | "deal";

type RelatedTasksSectionProps = {
  organizationId: string;
  relationType: RelationType;
  relationId: string;
  canCreateTasks: boolean;
  relationIsArchived?: boolean;
};

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

export async function RelatedTasksSection({
  organizationId,
  relationType,
  relationId,
  canCreateTasks,
  relationIsArchived = false,
}: RelatedTasksSectionProps) {
  const relationCondition =
    relationType === "client"
      ? eq(
          tasks.clientId,
          relationId,
        )
      : relationType === "company"
        ? eq(
            tasks.companyId,
            relationId,
          )
        : eq(
            tasks.dealId,
            relationId,
          );

  const taskRows =
    await db
      .select({
        id: tasks.id,
        title: tasks.title,
        status: tasks.status,
        priority: tasks.priority,
        dueAt: tasks.dueAt,
        createdAt: tasks.createdAt,
      })
      .from(tasks)
      .where(
        and(
          eq(
            tasks.organizationId,
            organizationId,
          ),
          relationCondition,
          eq(
            tasks.isArchived,
            false,
          ),
          isNull(
            tasks.deletedAt,
          ),
        ),
      )
      .orderBy(
        asc(tasks.dueAt),
        desc(tasks.createdAt),
      )
      .limit(8);

  const createHref =
    relationType === "client"
      ? `/crm/tasks/new?clientId=${relationId}`
      : relationType === "company"
        ? `/crm/tasks/new?companyId=${relationId}`
        : `/crm/tasks/new?dealId=${relationId}`;

  const now = new Date();

  return (
    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">
            Задачи
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Связанные рабочие задачи: {taskRows.length}
          </p>
        </div>

        {canCreateTasks &&
          !relationIsArchived && (
            <Link
              href={createHref}
              className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              + Новая задача
            </Link>
          )}
      </div>

      {taskRows.length === 0 ? (
        <p className="mt-5 text-sm text-slate-400">
          Связанных задач пока нет.
        </p>
      ) : (
        <div className="mt-5 divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200">
          {taskRows.map((task) => {
            const isOverdue = Boolean(
              task.dueAt &&
                task.dueAt < now &&
                task.status !==
                  "completed" &&
                task.status !==
                  "cancelled",
            );

            return (
              <div
                key={task.id}
                className="flex flex-wrap items-center justify-between gap-4 px-4 py-3"
              >
                <div className="min-w-0">
                  <Link
                    href={`/crm/tasks/${task.id}`}
                    className="font-medium text-slate-950 transition hover:text-blue-700 hover:underline"
                  >
                    {task.title}
                  </Link>

                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span>
                      {statusLabels[
                        task.status
                      ] ?? task.status}
                    </span>

                    <span>
                      {priorityLabels[
                        task.priority
                      ] ?? task.priority}
                    </span>

                    {isOverdue && (
                      <span className="font-medium text-red-600">
                        Просрочена
                      </span>
                    )}
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
                    "Без срока"
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4">
        <Link
          href="/crm/tasks"
          className="text-sm font-medium text-slate-600 transition hover:text-slate-950"
        >
          Все задачи →
        </Link>
      </div>
    </section>
  );
}
