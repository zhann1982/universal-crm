"use server";

import { randomUUID } from "node:crypto";
import { changeTaskState, dismissReminder, type TaskStateAction } from "@/modules/tasks/change-task-state";
import { saveTask, completeTaskRecord } from "@/modules/tasks/save-task";

import {
  and,
  eq,
  isNull,
} from "drizzle-orm";
import {
  revalidatePath,
} from "next/cache";
import {
  redirect,
} from "next/navigation";

import { db } from "@/db";
import {
  clients,
  companies,
  deals,
  tasks,
} from "@/db/schema";
import {
  taskSchedules,
} from "@/db/task-scheduling-schema";
import {
  requirePermission,
} from "@/lib/auth/permissions";
import {
  createTaskSchema,
  taskIdSchema,
  taskVersionSchema,
  taskScheduleVersionSchema,
  updateTaskSchema,
  type CreateTaskState,
  type UpdateTaskState,
} from "@/lib/validation/task";
import {
  resolveOwnerAssignment,
} from "@/modules/members/owner-assignment";

import {
  buildTaskCreatedEvents,
  buildTaskUpdateEvents,
} from "@/modules/activity/task-activity";

function getFormValues(
  formData: FormData,
  fallback?: {
    ownerMemberId?: string | null;
    clientId?: string | null;
    companyId?: string | null;
    dealId?: string | null;
  },
) {
  const getValue = (
    name: string,
    fallbackValue = "",
  ) => {
    const value = formData.get(name);

    return value === null
      ? fallbackValue
      : String(value);
  };

  return {
    title: String(
      formData.get("title") ?? "",
    ),

    description: String(
      formData.get(
        "description",
      ) ?? "",
    ),

    status: String(
      formData.get("status") ??
        "todo",
    ),

    priority: String(
      formData.get("priority") ??
        "normal",
    ),

    dueAt: String(
      formData.get("dueAt") ?? "",
    ),

    reminderAt: String(
      formData.get("reminderAt") ?? "",
    ),

    recurrenceFrequency: String(
      formData.get(
        "recurrenceFrequency",
      ) ?? "none",
    ),

    recurrenceInterval: String(
      formData.get(
        "recurrenceInterval",
      ) ?? "1",
    ),

    recurrenceEndAt: String(
      formData.get(
        "recurrenceEndAt",
      ) ?? "",
    ),

    ownerMemberId: getValue(
      "ownerMemberId",
      fallback?.ownerMemberId ?? "",
    ),

    clientId: getValue(
      "clientId",
      fallback?.clientId ?? "",
    ),

    companyId: getValue(
      "companyId",
      fallback?.companyId ?? "",
    ),

    dealId: getValue(
      "dealId",
      fallback?.dealId ?? "",
    ),
  };
}

async function validateClientRelation({
  organizationId,
  requestedId,
  existingId,
  canRead,
}: {
  organizationId: string;
  requestedId: string | null;
  existingId: string | null;
  canRead: boolean;
}) {
  if (
    requestedId === existingId ||
    requestedId === null
  ) {
    return null;
  }

  if (!canRead) {
    return "Нет доступа к клиентам.";
  }

  const [client] =
    await db
      .select({
        id: clients.id,
      })
      .from(clients)
      .where(
        and(
          eq(
            clients.id,
            requestedId,
          ),
          eq(
            clients.organizationId,
            organizationId,
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
      .limit(1);

  return client
    ? null
    : "Выбранный клиент недоступен.";
}

async function validateCompanyRelation({
  organizationId,
  requestedId,
  existingId,
  canRead,
}: {
  organizationId: string;
  requestedId: string | null;
  existingId: string | null;
  canRead: boolean;
}) {
  if (
    requestedId === existingId ||
    requestedId === null
  ) {
    return null;
  }

  if (!canRead) {
    return "Нет доступа к компаниям.";
  }

  const [company] =
    await db
      .select({
        id: companies.id,
      })
      .from(companies)
      .where(
        and(
          eq(
            companies.id,
            requestedId,
          ),
          eq(
            companies.organizationId,
            organizationId,
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
      .limit(1);

  return company
    ? null
    : "Выбранная компания недоступна.";
}

async function validateDealRelation({
  organizationId,
  requestedId,
  existingId,
  canRead,
}: {
  organizationId: string;
  requestedId: string | null;
  existingId: string | null;
  canRead: boolean;
}) {
  if (
    requestedId === existingId ||
    requestedId === null
  ) {
    return null;
  }

  if (!canRead) {
    return "Нет доступа к сделкам.";
  }

  const [deal] =
    await db
      .select({
        id: deals.id,
      })
      .from(deals)
      .where(
        and(
          eq(
            deals.id,
            requestedId,
          ),
          eq(
            deals.organizationId,
            organizationId,
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
      .limit(1);

  return deal
    ? null
    : "Выбранная сделка недоступна.";
}

export async function createTask(
  _previousState:
    CreateTaskState,
  formData: FormData,
): Promise<CreateTaskState> {
  const {
    organization,
    member,
    permissions,
  } = await requirePermission(
    "tasks.create",
  );

  const values =
    getFormValues(
      formData,
    );

  const result =
    createTaskSchema.safeParse(
      values,
    );

  if (!result.success) {
    return {
      values,
      errors:
        result.error
          .flatten()
          .fieldErrors,
      message:
        "Проверьте данные формы.",
    };
  }

  const data = result.data;

  const ownerResult =
    await resolveOwnerAssignment({
      organizationId:
        organization.id,
      mode: "create",
      currentMemberId:
        member.id,
      canReadMembers:
        permissions.has(
          "members.read",
        ),
      requestedOwnerMemberId:
        data.ownerMemberId,
    });

  if (
    ownerResult.status ===
    "forbidden"
  ) {
    return {
      values,
      errors: {
        ownerMemberId: [
          "Нельзя назначить этого сотрудника.",
        ],
      },
      message:
        "Проверьте данные формы.",
    };
  }

  if (
    ownerResult.status ===
    "owner-unavailable"
  ) {
    return {
      values,
      errors: {
        ownerMemberId: [
          "Ответственный сотрудник недоступен.",
        ],
      },
      message:
        "Проверьте данные формы.",
    };
  }

  const clientError =
    await validateClientRelation({
      organizationId:
        organization.id,
      requestedId:
        data.clientId,
      existingId: null,
      canRead:
        permissions.has(
          "clients.read",
        ),
    });

  if (clientError) {
    return {
      values,
      errors: {
        clientId: [clientError],
      },
      message:
        "Проверьте данные формы.",
    };
  }

  const companyError =
    await validateCompanyRelation({
      organizationId:
        organization.id,
      requestedId:
        data.companyId,
      existingId: null,
      canRead:
        permissions.has(
          "companies.read",
        ),
    });

  if (companyError) {
    return {
      values,
      errors: {
        companyId: [companyError],
      },
      message:
        "Проверьте данные формы.",
    };
  }

  const dealError =
    await validateDealRelation({
      organizationId:
        organization.id,
      requestedId:
        data.dealId,
      existingId: null,
      canRead:
        permissions.has(
          "deals.read",
        ),
    });

  if (dealError) {
    return {
      values,
      errors: {
        dealId: [dealError],
      },
      message:
        "Проверьте данные формы.",
    };
  }

  try {
    const created = await saveTask({
      taskId: randomUUID(),
      organizationId: organization.id,
      actorMemberId: member.id,
      expectedVersion: null,
      expectedScheduleVersion: null,
      task: data,
      schedule: { ...data, recurrenceSeriesId: null, recurrenceSequence: 1 },
      events: buildTaskCreatedEvents(data),
      createNextOccurrence: data.status === "completed",
    });
    if (!created) throw new Error("Task insert returned no row");
  } catch (error) {
    console.error("Failed to create task:", error);
    return { values, message: "Не удалось создать задачу. Попробуйте ещё раз." };
  }

  revalidatePath("/crm");
  revalidatePath(
    "/crm/tasks",
  );

  redirect(
    "/crm/tasks",
  );
}

export async function updateTask(
  _previousState:
    UpdateTaskState,
  formData: FormData,
): Promise<UpdateTaskState> {
  const {
    organization,
    member,
    permissions,
  } = await requirePermission(
    "tasks.update",
  );

  const idResult =
    taskIdSchema.safeParse(
      formData.get("taskId"),
    );

  const versionResult =
    taskVersionSchema.safeParse(
      formData.get("version"),
    );

  const rawValues =
    getFormValues(
      formData,
    );

  if (!idResult.success) {
    return {
      values: rawValues,
      message:
        "Некорректный идентификатор задачи.",
    };
  }

  if (!versionResult.success) {
    return {
      values: rawValues,
      message:
        "Не удалось определить версию задачи. Обновите страницу.",
    };
  }

  const [existingTask] =
    await db
      .select({
        id: tasks.id,
        version: tasks.version,
        isArchived:
          tasks.isArchived,
        ownerMemberId:
          tasks.ownerMemberId,
        clientId:
          tasks.clientId,
        companyId:
          tasks.companyId,
        dealId:
          tasks.dealId,
        title: tasks.title,
        description:
          tasks.description,
        status:
          tasks.status,
        priority:
          tasks.priority,
        dueAt:
          tasks.dueAt,
        completedAt:
          tasks.completedAt,
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

  if (!existingTask) {
    return {
      values: rawValues,
      message:
        "Задача не найдена.",
    };
  }

  if (existingTask.isArchived) {
    return {
      values: rawValues,
      message:
        "Задача находится в архиве. Сначала восстановите её.",
    };
  }

  if (
    existingTask.version !==
    versionResult.data
  ) {
    return {
      values: rawValues,
      message:
        "Задача была изменена после открытия формы. Обновите страницу и повторите изменения.",
    };
  }

  const [existingSchedule] =
    await db
      .select({
        version: taskSchedules.version,
        reminderAt:
          taskSchedules.reminderAt,
        reminderDismissedAt:
          taskSchedules.reminderDismissedAt,
        recurrenceFrequency:
          taskSchedules.recurrenceFrequency,
        recurrenceInterval:
          taskSchedules.recurrenceInterval,
        recurrenceEndAt:
          taskSchedules.recurrenceEndAt,
        recurrenceSeriesId:
          taskSchedules.recurrenceSeriesId,
        recurrenceSequence:
          taskSchedules.recurrenceSequence,
      })
      .from(taskSchedules)
      .where(
        and(
          eq(
            taskSchedules.taskId,
            existingTask.id,
          ),
          eq(
            taskSchedules.organizationId,
            organization.id,
          ),
        ),
      )
      .limit(1);

  const values =
    getFormValues(
      formData,
      {
        ownerMemberId:
          existingTask.ownerMemberId,
        clientId:
          existingTask.clientId,
        companyId:
          existingTask.companyId,
        dealId:
          existingTask.dealId,
      },
    );

  const result =
    updateTaskSchema.safeParse(
      values,
    );

  if (!result.success) {
    return {
      values,
      errors:
        result.error
          .flatten()
          .fieldErrors,
      message:
        "Проверьте данные формы.",
    };
  }

  const data = result.data;

  const ownerResult =
    await resolveOwnerAssignment({
      organizationId:
        organization.id,
      mode: "update",
      currentMemberId:
        member.id,
      canReadMembers:
        permissions.has(
          "members.read",
        ),
      requestedOwnerMemberId:
        data.ownerMemberId,
      existingOwnerMemberId:
        existingTask.ownerMemberId,
    });

  if (
    ownerResult.status ===
    "forbidden"
  ) {
    return {
      values,
      errors: {
        ownerMemberId: [
          "Нельзя назначить этого сотрудника.",
        ],
      },
      message:
        "Проверьте данные формы.",
    };
  }

  if (
    ownerResult.status ===
    "owner-unavailable"
  ) {
    return {
      values,
      errors: {
        ownerMemberId: [
          "Ответственный сотрудник недоступен.",
        ],
      },
      message:
        "Проверьте данные формы.",
    };
  }

  const clientError =
    await validateClientRelation({
      organizationId:
        organization.id,
      requestedId:
        data.clientId,
      existingId:
        existingTask.clientId,
      canRead:
        permissions.has(
          "clients.read",
        ),
    });

  if (clientError) {
    return {
      values,
      errors: {
        clientId: [clientError],
      },
      message:
        "Проверьте данные формы.",
    };
  }

  const companyError =
    await validateCompanyRelation({
      organizationId:
        organization.id,
      requestedId:
        data.companyId,
      existingId:
        existingTask.companyId,
      canRead:
        permissions.has(
          "companies.read",
        ),
    });

  if (companyError) {
    return {
      values,
      errors: {
        companyId: [companyError],
      },
      message:
        "Проверьте данные формы.",
    };
  }

  const dealError =
    await validateDealRelation({
      organizationId:
        organization.id,
      requestedId:
        data.dealId,
      existingId:
        existingTask.dealId,
      canRead:
        permissions.has(
          "deals.read",
        ),
    });

  if (dealError) {
    return {
      values,
      errors: {
        dealId: [dealError],
      },
      message:
        "Проверьте данные формы.",
    };
  }

  try {
    const updated = await saveTask({
      taskId: existingTask.id,
      organizationId: organization.id,
      actorMemberId: member.id,
      expectedVersion: versionResult.data,
      expectedScheduleVersion: existingSchedule?.version ?? null,
      task: data,
      schedule: {
        ...data,
        recurrenceSeriesId: existingSchedule?.recurrenceSeriesId ?? null,
        recurrenceSequence: existingSchedule?.recurrenceSequence ?? 1,
      },
      events: buildTaskUpdateEvents({
        previous: {
          title:
            existingTask.title,
          description:
            existingTask.description,
          status:
            existingTask.status,
          priority:
            existingTask.priority,
          ownerMemberId:
            existingTask.ownerMemberId,
          dueAt:
            existingTask.dueAt,
          clientId:
            existingTask.clientId,
          companyId:
            existingTask.companyId,
          dealId:
            existingTask.dealId,
        },
        next: {
          title: data.title,
          description:
            data.description,
          status: data.status,
          priority:
            data.priority,
          ownerMemberId:
            data.ownerMemberId,
          dueAt: data.dueAt,
          clientId:
            data.clientId,
          companyId:
            data.companyId,
          dealId: data.dealId,
        },
        previousSchedule:
          existingSchedule
            ? {
                reminderAt:
                  existingSchedule.reminderAt,
                recurrenceFrequency:
                  existingSchedule.recurrenceFrequency,
                recurrenceInterval:
                  existingSchedule.recurrenceInterval,
                recurrenceEndAt:
                  existingSchedule.recurrenceEndAt,
              }
            : null,
        nextSchedule: {
          reminderAt:
            data.reminderAt,
          recurrenceFrequency:
            data.recurrenceFrequency,
          recurrenceInterval:
            data.recurrenceFrequency ===
            "none"
              ? 1
              : data.recurrenceInterval,
          recurrenceEndAt:
            data.recurrenceFrequency ===
            "none"
              ? null
              : data.recurrenceEndAt,
        },
      }),
      createNextOccurrence: existingTask.status !== "completed" && data.status === "completed",
    });
    if (!updated) {
      return { values, message: "Задача или её расписание были изменены. Обновите страницу и повторите попытку." };
    }
    if (updated.nextTaskId) revalidateTaskPaths(updated.nextTaskId);
  } catch (error) {
    console.error(
      "Failed to update task:",
      error,
    );

    return {
      values,
      message:
        "Не удалось сохранить изменения.",
    };
  }

  revalidateTaskPaths(
    existingTask.id,
  );

  redirect(
    `/crm/tasks/${existingTask.id}`,
  );
}

export async function completeTask(
  formData: FormData,
) {
  const { organization, member } =
    await requirePermission(
      "tasks.update",
    );

  const parsed =
    parseTaskMutationForm(
      formData,
    );

  if (!parsed) {
    redirect("/crm/tasks");
  }

  const returnTo =
    getTaskReturnTo(formData);

  const updated = await completeTaskRecord({
    taskId: parsed.taskId,
    organizationId: organization.id,
    actorMemberId: member.id,
    expectedVersion: parsed.version,
  });

  if (!updated) {
    redirect(
      returnTo
        ? withTaskError(
            returnTo,
            "conflict",
          )
        : `/crm/tasks/${parsed.taskId}?error=conflict`,
    );
  }

  if (updated.nextTaskId) revalidateTaskPaths(updated.nextTaskId);

  revalidateTaskPaths(
    updated.id,
  );

  redirect(
    returnTo ??
      `/crm/tasks/${updated.id}`,
  );
}

export async function reopenTask(
  formData: FormData,
) {
  const { organization, member } =
    await requirePermission(
      "tasks.update",
    );

  const parsed =
    parseTaskMutationForm(
      formData,
    );

  if (!parsed) {
    redirect("/crm/tasks");
  }

  const returnTo =
    getTaskReturnTo(formData);

  const updated = await changeTaskState({
    taskId: parsed.taskId, organizationId: organization.id,
    actorMemberId: member.id, expectedVersion: parsed.version, action: "reopen",
  });

  if (!updated) {
    redirect(
      returnTo
        ? withTaskError(
            returnTo,
            "conflict",
          )
        : `/crm/tasks/${parsed.taskId}?error=conflict`,
    );
  }

  revalidateTaskPaths(
    updated.id,
  );

  redirect(
    returnTo ??
      `/crm/tasks/${updated.id}`,
  );
}

export async function archiveTask(
  formData: FormData,
) {
  const { organization, member } =
    await requirePermission(
      "tasks.archive",
    );

  const parsed =
    parseTaskMutationForm(
      formData,
    );

  if (!parsed) {
    redirect("/crm/tasks");
  }

  const returnTo =
    getTaskReturnTo(formData);

  const archived = await changeTaskState({
    taskId: parsed.taskId, organizationId: organization.id,
    actorMemberId: member.id, expectedVersion: parsed.version, action: "archive",
  });

  if (!archived) {
    redirect(
      returnTo
        ? withTaskError(
            returnTo,
            "conflict",
          )
        : `/crm/tasks/${parsed.taskId}?error=conflict`,
    );
  }

  revalidateTaskPaths(
    archived.id,
  );

  redirect(
    returnTo ??
      "/crm/tasks",
  );
}

export async function restoreTask(
  formData: FormData,
) {
  const { organization, member } =
    await requirePermission(
      "tasks.archive",
    );

  const parsed =
    parseTaskMutationForm(
      formData,
    );

  if (!parsed) {
    redirect(
      "/crm/tasks?view=archive",
    );
  }

  const returnTo =
    getTaskReturnTo(formData);

  const restored = await changeTaskState({
    taskId: parsed.taskId, organizationId: organization.id,
    actorMemberId: member.id, expectedVersion: parsed.version, action: "restore",
  });

  if (!restored) {
    redirect(
      returnTo
        ? withTaskError(
            returnTo,
            "conflict",
          )
        : `/crm/tasks/${parsed.taskId}?error=conflict`,
    );
  }

  revalidateTaskPaths(
    restored.id,
  );

  redirect(
    returnTo ??
      `/crm/tasks/${restored.id}`,
  );
}

export async function bulkTaskAction(
  formData: FormData,
) {
  const rawAction =
    formData.get("bulkAction");

  const action =
    typeof rawAction === "string"
      ? rawAction
      : "";

  const allowedActions = new Set([
    "todo",
    "in_progress",
    "complete",
    "cancel",
    "archive",
    "restore",
  ]);

  if (
    !allowedActions.has(
      action,
    )
  ) {
    redirect("/crm/tasks");
  }

  const needsArchivePermission =
    action === "archive" ||
    action === "restore";

  const {
    organization,
    member,
  } = await requirePermission(
    needsArchivePermission
      ? "tasks.archive"
      : "tasks.update",
  );

  const returnTo =
    getTaskReturnTo(
      formData,
    ) ??
    "/crm/tasks";

  const selectedIds =
    formData
      .getAll("taskIds")
      .map((value) =>
        String(value),
      )
      .filter((value) =>
        taskIdSchema.safeParse(
          value,
        ).success,
      );

  const uniqueIds =
    Array.from(
      new Set(selectedIds),
    ).slice(0, 100);

  if (
    uniqueIds.length === 0
  ) {
    redirect(
      withTaskBulkResult(
        returnTo,
        "no-selection",
        0,
        0,
      ),
    );
  }

  let updatedCount = 0;
  let conflictCount = 0;

  for (
    const taskId of uniqueIds
  ) {
    const versionResult =
      taskVersionSchema.safeParse(
        formData.get(
          `version:${taskId}`,
        ),
      );

    if (
      !versionResult.success
    ) {
      conflictCount += 1;
      continue;
    }

    if (action === "complete") {
      const result = await completeTaskRecord({
        taskId, organizationId: organization.id, actorMemberId: member.id,
        expectedVersion: versionResult.data,
      });
      if (!result) { conflictCount += 1; continue; }
      updatedCount += 1;
      revalidateTaskPaths(result.id);
      if (result.nextTaskId) revalidateTaskPaths(result.nextTaskId);
      continue;
    }

    const result = await changeTaskState({
      taskId, organizationId: organization.id, actorMemberId: member.id,
      expectedVersion: versionResult.data, action: action as TaskStateAction,
    });
    const updatedId = result?.id;

    if (!updatedId) {
      conflictCount += 1;
      continue;
    }

    updatedCount += 1;

    revalidateTaskPaths(
      updatedId,
    );
  }

  redirect(
    withTaskBulkResult(
      returnTo,
      "done",
      updatedCount,
      conflictCount,
    ),
  );
}

export async function dismissTaskReminder(
  formData: FormData,
) {
  const { organization, member } =
    await requirePermission(
      "tasks.update",
    );

  const idResult =
    taskIdSchema.safeParse(
      formData.get("taskId"),
    );

  const versionResult =
    taskScheduleVersionSchema.safeParse(
      formData.get(
        "scheduleVersion",
      ),
    );

  const returnTo =
    getTaskReturnTo(formData) ??
    "/crm/tasks?view=reminders";

  if (
    !idResult.success ||
    !versionResult.success
  ) {
    redirect(returnTo);
  }

  const updated = await dismissReminder({
    taskId: idResult.data, organizationId: organization.id,
    actorMemberId: member.id, expectedVersion: versionResult.data,
  });

  if (!updated) {
    redirect(
      withTaskError(
        returnTo,
        "conflict",
      ),
    );
  }

  revalidateTaskPaths(
    updated.taskId,
  );

  redirect(returnTo);
}

function getTaskReturnTo(
  formData: FormData,
) {
  const value =
    formData.get("returnTo");

  if (typeof value !== "string") {
    return null;
  }

  const normalized =
    value.trim();

  if (normalized === "/crm") {
    return normalized;
  }

  if (
    normalized === "/crm/tasks" ||
    normalized.startsWith(
      "/crm/tasks?",
    ) ||
    /^\/crm\/tasks\/[0-9a-f-]{36}$/i.test(
      normalized,
    )
  ) {
    return normalized;
  }

  return null;
}

function withTaskBulkResult(
  returnTo: string,
  bulk: string,
  updated: number,
  conflicts: number,
) {
  const queryIndex =
    returnTo.indexOf("?");

  const params =
    new URLSearchParams(
      queryIndex >= 0
        ? returnTo.slice(
            queryIndex + 1,
          )
        : "",
    );

  params.delete("error");
  params.set("bulk", bulk);

  if (
    bulk === "done"
  ) {
    params.set(
      "updated",
      String(updated),
    );
    params.set(
      "conflicts",
      String(conflicts),
    );
  } else {
    params.delete("updated");
    params.delete("conflicts");
  }

  return `/crm/tasks?${params.toString()}`;
}

function withTaskError(
  returnTo: string,
  error: string,
) {
  if (returnTo === "/crm") {
    return "/crm";
  }

  if (
    /^\/crm\/tasks\/[0-9a-f-]{36}$/i.test(
      returnTo,
    )
  ) {
    return `${returnTo}?error=${encodeURIComponent(
      error,
    )}`;
  }

  const queryIndex =
    returnTo.indexOf("?");

  const params =
    new URLSearchParams(
      queryIndex >= 0
        ? returnTo.slice(
            queryIndex + 1,
          )
        : "",
    );

  params.set("error", error);

  return `/crm/tasks?${params.toString()}`;
}

function parseTaskMutationForm(
  formData: FormData,
) {
  const idResult =
    taskIdSchema.safeParse(
      formData.get("taskId"),
    );

  const versionResult =
    taskVersionSchema.safeParse(
      formData.get("version"),
    );

  if (
    !idResult.success ||
    !versionResult.success
  ) {
    return null;
  }

  return {
    taskId: idResult.data,
    version:
      versionResult.data,
  };
}

function revalidateTaskPaths(
  taskId: string,
) {
  revalidatePath("/crm");
  revalidatePath(
    "/crm/tasks",
  );
  revalidatePath(
    `/crm/tasks/${taskId}`,
  );
  revalidatePath(
    `/crm/tasks/${taskId}/edit`,
  );
}
