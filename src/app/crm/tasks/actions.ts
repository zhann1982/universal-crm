"use server";

import {
  and,
  eq,
  isNull,
  ne,
  sql,
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
  requirePermission,
} from "@/lib/auth/permissions";
import {
  createTaskSchema,
  taskIdSchema,
  taskVersionSchema,
  updateTaskSchema,
  type CreateTaskState,
  type UpdateTaskState,
} from "@/lib/validation/task";
import {
  resolveOwnerAssignment,
} from "@/modules/members/owner-assignment";

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
    await db
      .insert(tasks)
      .values({
        organizationId:
          organization.id,
        ownerMemberId:
          data.ownerMemberId,
        createdByMemberId:
          member.id,
        clientId:
          data.clientId,
        companyId:
          data.companyId,
        dealId:
          data.dealId,
        title:
          data.title,
        description:
          data.description,
        status:
          data.status,
        priority:
          data.priority,
        dueAt:
          data.dueAt,
        completedAt:
          data.status ===
          "completed"
            ? new Date()
            : null,
      });
  } catch (error) {
    console.error(
      "Failed to create task:",
      error,
    );

    return {
      values,
      message:
        "Не удалось создать задачу. Попробуйте ещё раз.",
    };
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
        status:
          tasks.status,
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

  const completedAt =
    data.status === "completed"
      ? existingTask.status ===
          "completed" &&
        existingTask.completedAt
        ? existingTask.completedAt
        : new Date()
      : null;

  try {
    const updated =
      await db
        .update(tasks)
        .set({
          ownerMemberId:
            data.ownerMemberId,
          clientId:
            data.clientId,
          companyId:
            data.companyId,
          dealId:
            data.dealId,
          title:
            data.title,
          description:
            data.description,
          status:
            data.status,
          priority:
            data.priority,
          dueAt:
            data.dueAt,
          completedAt,
          version:
            sql`${tasks.version} + 1`,
          updatedAt:
            new Date(),
        })
        .where(
          and(
            eq(
              tasks.id,
              existingTask.id,
            ),
            eq(
              tasks.organizationId,
              organization.id,
            ),
            eq(
              tasks.version,
              versionResult.data,
            ),
            eq(
              tasks.isArchived,
              false,
            ),
            isNull(
              tasks.deletedAt,
            ),
          ),
        )
        .returning({
          id: tasks.id,
        });

    if (updated.length === 0) {
      return {
        values,
        message:
          "Задача была изменена другим действием. Обновите страницу и повторите попытку.",
      };
    }
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
  const { organization } =
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

  const [updated] =
    await db
      .update(tasks)
      .set({
        status: "completed",
        completedAt:
          new Date(),
        version:
          sql`${tasks.version} + 1`,
        updatedAt:
          new Date(),
      })
      .where(
        and(
          eq(
            tasks.id,
            parsed.taskId,
          ),
          eq(
            tasks.organizationId,
            organization.id,
          ),
          eq(
            tasks.version,
            parsed.version,
          ),
          ne(
            tasks.status,
            "completed",
          ),
          eq(
            tasks.isArchived,
            false,
          ),
          isNull(
            tasks.deletedAt,
          ),
        ),
      )
      .returning({
        id: tasks.id,
      });

  if (!updated) {
    redirect(
      `/crm/tasks/${parsed.taskId}?error=conflict`,
    );
  }

  revalidateTaskPaths(
    updated.id,
  );

  redirect(
    `/crm/tasks/${updated.id}`,
  );
}

export async function reopenTask(
  formData: FormData,
) {
  const { organization } =
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

  const [updated] =
    await db
      .update(tasks)
      .set({
        status:
          "in_progress",
        completedAt: null,
        version:
          sql`${tasks.version} + 1`,
        updatedAt:
          new Date(),
      })
      .where(
        and(
          eq(
            tasks.id,
            parsed.taskId,
          ),
          eq(
            tasks.organizationId,
            organization.id,
          ),
          eq(
            tasks.version,
            parsed.version,
          ),
          eq(
            tasks.status,
            "completed",
          ),
          eq(
            tasks.isArchived,
            false,
          ),
          isNull(
            tasks.deletedAt,
          ),
        ),
      )
      .returning({
        id: tasks.id,
      });

  if (!updated) {
    redirect(
      `/crm/tasks/${parsed.taskId}?error=conflict`,
    );
  }

  revalidateTaskPaths(
    updated.id,
  );

  redirect(
    `/crm/tasks/${updated.id}`,
  );
}

export async function archiveTask(
  formData: FormData,
) {
  const { organization } =
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

  const [archived] =
    await db
      .update(tasks)
      .set({
        isArchived: true,
        version:
          sql`${tasks.version} + 1`,
        updatedAt:
          new Date(),
      })
      .where(
        and(
          eq(
            tasks.id,
            parsed.taskId,
          ),
          eq(
            tasks.organizationId,
            organization.id,
          ),
          eq(
            tasks.version,
            parsed.version,
          ),
          eq(
            tasks.isArchived,
            false,
          ),
          isNull(
            tasks.deletedAt,
          ),
        ),
      )
      .returning({
        id: tasks.id,
      });

  if (!archived) {
    redirect(
      `/crm/tasks/${parsed.taskId}?error=conflict`,
    );
  }

  revalidateTaskPaths(
    archived.id,
  );

  redirect(
    "/crm/tasks",
  );
}

export async function restoreTask(
  formData: FormData,
) {
  const { organization } =
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

  const [restored] =
    await db
      .update(tasks)
      .set({
        isArchived: false,
        version:
          sql`${tasks.version} + 1`,
        updatedAt:
          new Date(),
      })
      .where(
        and(
          eq(
            tasks.id,
            parsed.taskId,
          ),
          eq(
            tasks.organizationId,
            organization.id,
          ),
          eq(
            tasks.version,
            parsed.version,
          ),
          eq(
            tasks.isArchived,
            true,
          ),
          isNull(
            tasks.deletedAt,
          ),
        ),
      )
      .returning({
        id: tasks.id,
      });

  if (!restored) {
    redirect(
      `/crm/tasks/${parsed.taskId}?error=conflict`,
    );
  }

  revalidateTaskPaths(
    restored.id,
  );

  redirect(
    `/crm/tasks/${restored.id}`,
  );
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
