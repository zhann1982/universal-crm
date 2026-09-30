"use server";

import {
  randomUUID,
} from "node:crypto";

import {
  and,
  eq,
  isNull,
} from "drizzle-orm";
import {
  revalidatePath,
} from "next/cache";

import {
  db,
  sql,
} from "@/db";
import {
  comments,
} from "@/db/activity-schema";
import {
  requirePermission,
} from "@/lib/auth/permissions";
import {
  commentEntityTypeSchema,
  commentLifecycleSchema,
  createCommentSchema,
  updateCommentSchema,
  type CommentActionState,
} from "@/lib/validation/comment";
import {
  getEntityTarget,
} from "@/modules/activity/entity-target";
import {
  getEntityHref,
  getEntityReadPermission,
} from "@/modules/activity/entity-types";

async function loadComment(
  organizationId: string,
  commentId: string,
) {
  const [comment] = await db
    .select({
      id: comments.id,
      entityType:
        comments.entityType,
      entityId:
        comments.entityId,
      authorMemberId:
        comments.authorMemberId,
      body: comments.body,
      isArchived:
        comments.isArchived,
      version:
        comments.version,
    })
    .from(comments)
    .where(
      and(
        eq(
          comments.id,
          commentId,
        ),
        eq(
          comments.organizationId,
          organizationId,
        ),
        isNull(
          comments.deletedAt,
        ),
      ),
    )
    .limit(1);

  return comment ?? null;
}

export async function createComment(
  _previousState:
    CommentActionState,
  formData: FormData,
): Promise<CommentActionState> {
  const {
    organization,
    member,
    permissions,
  } = await requirePermission(
    "comments.create",
  );

  const rawBody = String(
    formData.get("body") ?? "",
  );

  const parsed =
    createCommentSchema.safeParse({
      entityType:
        formData.get(
          "entityType",
        ),
      entityId:
        formData.get(
          "entityId",
        ),
      body: rawBody,
    });

  if (!parsed.success) {
    return {
      values: {
        body: rawBody,
      },
      errors:
        parsed.error
          .flatten()
          .fieldErrors,
      message:
        "Проверьте комментарий.",
    };
  }

  const data = parsed.data;

  if (
    !permissions.has(
      getEntityReadPermission(
        data.entityType,
      ),
    )
  ) {
    return {
      values: {
        body: data.body,
      },
      message:
        "Нет доступа к этой CRM-записи.",
    };
  }

  const target =
    await getEntityTarget({
      organizationId:
        organization.id,
      entityType:
        data.entityType,
      entityId:
        data.entityId,
    });

  if (!target) {
    return {
      values: {
        body: data.body,
      },
      message:
        "CRM-запись не найдена.",
    };
  }

  if (target.isArchived) {
    return {
      values: {
        body: data.body,
      },
      message:
        "Нельзя добавлять комментарии к записи в архиве.",
    };
  }

  const commentId =
    randomUUID();
  const eventId =
    randomUUID();

  try {
    const rows = await sql`
      WITH inserted_comment AS (
        INSERT INTO comments (
          id,
          organization_id,
          entity_type,
          entity_id,
          author_member_id,
          body
        )
        VALUES (
          ${commentId}::uuid,
          ${organization.id}::uuid,
          ${data.entityType},
          ${data.entityId}::uuid,
          ${member.id}::uuid,
          ${data.body}
        )
        RETURNING id
      )
      INSERT INTO activity_events (
        id,
        organization_id,
        entity_type,
        entity_id,
        actor_member_id,
        comment_id,
        event_type,
        summary,
        details
      )
      SELECT
        ${eventId}::uuid,
        ${organization.id}::uuid,
        ${data.entityType},
        ${data.entityId}::uuid,
        ${member.id}::uuid,
        inserted_comment.id,
        'comment.created',
        'Добавлен комментарий',
        ${data.body}
      FROM inserted_comment
      RETURNING id
    `;

    if (rows.length === 0) {
      throw new Error(
        "Comment insert returned no rows",
      );
    }
  } catch (error) {
    console.error(
      "Failed to create comment:",
      error,
    );

    return {
      values: {
        body: data.body,
      },
      message:
        "Не удалось добавить комментарий.",
    };
  }

  revalidatePath(
    getEntityHref(
      data.entityType,
      data.entityId,
    ),
  );

  return {
    success: true,
    message:
      "Комментарий добавлен.",
    values: {
      body: "",
    },
    revision:
      randomUUID(),
  };
}

export async function updateComment(
  _previousState:
    CommentActionState,
  formData: FormData,
): Promise<CommentActionState> {
  const {
    organization,
    member,
    permissions,
  } = await requirePermission(
    "comments.update",
  );

  const rawBody = String(
    formData.get("body") ?? "",
  );

  const parsed =
    updateCommentSchema.safeParse({
      commentId:
        formData.get(
          "commentId",
        ),
      version:
        formData.get(
          "version",
        ),
      body: rawBody,
    });

  if (!parsed.success) {
    return {
      values: {
        body: rawBody,
      },
      errors:
        parsed.error
          .flatten()
          .fieldErrors,
      message:
        "Проверьте комментарий.",
    };
  }

  const data = parsed.data;
  const comment =
    await loadComment(
      organization.id,
      data.commentId,
    );

  if (!comment) {
    return {
      values: {
        body: data.body,
      },
      message:
        "Комментарий не найден.",
    };
  }

  const entityTypeResult =
    commentEntityTypeSchema.safeParse(
      comment.entityType,
    );

  if (!entityTypeResult.success) {
    return {
      values: {
        body: data.body,
      },
      message:
        "Тип CRM-записи комментария некорректен.",
    };
  }

  const entityType =
    entityTypeResult.data;

  const canManage =
    permissions.has(
      "comments.manage",
    );

  if (
    comment.authorMemberId !==
      member.id &&
    !canManage
  ) {
    return {
      values: {
        body: data.body,
      },
      message:
        "Можно редактировать только свои комментарии.",
    };
  }

  if (
    !permissions.has(
      getEntityReadPermission(
        entityType,
      ),
    )
  ) {
    return {
      values: {
        body: data.body,
      },
      message:
        "Нет доступа к CRM-записи.",
    };
  }

  const target =
    await getEntityTarget({
      organizationId:
        organization.id,
      entityType,
      entityId:
        comment.entityId,
    });

  if (!target) {
    return {
      values: {
        body: data.body,
      },
      message:
        "CRM-запись не найдена.",
    };
  }

  if (target.isArchived) {
    return {
      values: {
        body: data.body,
      },
      message:
        "Нельзя редактировать комментарий у записи в архиве.",
    };
  }

  if (comment.isArchived) {
    return {
      values: {
        body: data.body,
      },
      message:
        "Комментарий находится в архиве.",
    };
  }

  const eventId =
    randomUUID();

  try {
    const rows = await sql`
      WITH updated_comment AS (
        UPDATE comments
        SET
          body = ${data.body},
          version = version + 1,
          updated_at = now()
        WHERE
          id = ${comment.id}::uuid
          AND organization_id =
            ${organization.id}::uuid
          AND version = ${data.version}
          AND is_archived = false
          AND deleted_at IS NULL
        RETURNING id
      )
      INSERT INTO activity_events (
        id,
        organization_id,
        entity_type,
        entity_id,
        actor_member_id,
        comment_id,
        event_type,
        summary,
        details
      )
      SELECT
        ${eventId}::uuid,
        ${organization.id}::uuid,
        ${entityType},
        ${comment.entityId}::uuid,
        ${member.id}::uuid,
        updated_comment.id,
        'comment.updated',
        'Комментарий изменён',
        ${data.body}
      FROM updated_comment
      RETURNING id
    `;

    if (rows.length === 0) {
      return {
        values: {
          body: data.body,
        },
        message:
          "Комментарий уже был изменён. Обновите страницу.",
      };
    }
  } catch (error) {
    console.error(
      "Failed to update comment:",
      error,
    );

    return {
      values: {
        body: data.body,
      },
      message:
        "Не удалось изменить комментарий.",
    };
  }

  revalidatePath(
    getEntityHref(
      entityType,
      comment.entityId,
    ),
  );

  return {
    success: true,
    message:
      "Комментарий изменён.",
    values: {
      body: data.body,
    },
    revision:
      randomUUID(),
  };
}

async function changeCommentArchiveState({
  formData,
  archive,
}: {
  formData: FormData;
  archive: boolean;
}) {
  const {
    organization,
    member,
    permissions,
  } = await requirePermission(
    "comments.archive",
  );

  const parsed =
    commentLifecycleSchema.safeParse({
      commentId:
        formData.get(
          "commentId",
        ),
      version:
        formData.get(
          "version",
        ),
    });

  if (!parsed.success) {
    return;
  }

  const comment =
    await loadComment(
      organization.id,
      parsed.data.commentId,
    );

  if (!comment) {
    return;
  }

  const entityTypeResult =
    commentEntityTypeSchema.safeParse(
      comment.entityType,
    );

  if (!entityTypeResult.success) {
    return;
  }

  const entityType =
    entityTypeResult.data;

  const canManage =
    permissions.has(
      "comments.manage",
    );

  if (
    comment.authorMemberId !==
      member.id &&
    !canManage
  ) {
    return;
  }

  if (
    !permissions.has(
      getEntityReadPermission(
        entityType,
      ),
    )
  ) {
    return;
  }

  const target =
    await getEntityTarget({
      organizationId:
        organization.id,
      entityType,
      entityId:
        comment.entityId,
    });

  if (!target) {
    return;
  }

  if (
    comment.isArchived ===
    archive
  ) {
    return;
  }

  const eventId =
    randomUUID();
  const eventType = archive
    ? "comment.archived"
    : "comment.restored";
  const summary = archive
    ? "Комментарий архивирован"
    : "Комментарий восстановлен";

  try {
    await sql`
      WITH changed_comment AS (
        UPDATE comments
        SET
          is_archived = ${archive},
          version = version + 1,
          updated_at = now()
        WHERE
          id = ${comment.id}::uuid
          AND organization_id =
            ${organization.id}::uuid
          AND version =
            ${parsed.data.version}
          AND deleted_at IS NULL
        RETURNING id
      )
      INSERT INTO activity_events (
        id,
        organization_id,
        entity_type,
        entity_id,
        actor_member_id,
        comment_id,
        event_type,
        summary
      )
      SELECT
        ${eventId}::uuid,
        ${organization.id}::uuid,
        ${entityType},
        ${comment.entityId}::uuid,
        ${member.id}::uuid,
        changed_comment.id,
        ${eventType},
        ${summary}
      FROM changed_comment
    `;
  } catch (error) {
    console.error(
      "Failed to change comment archive state:",
      error,
    );

    return;
  }

  revalidatePath(
    getEntityHref(
      entityType,
      comment.entityId,
    ),
  );
}

export async function archiveComment(
  formData: FormData,
): Promise<void> {
  await changeCommentArchiveState({
    formData,
    archive: true,
  });
}

export async function restoreComment(
  formData: FormData,
): Promise<void> {
  await changeCommentArchiveState({
    formData,
    archive: false,
  });
}
