import { randomUUID } from "node:crypto";
import { sql } from "@/db";
import type { ActivityEntityType } from "./entity-types";
import { writableCommentTargetSql } from "./comment-target";

// Authorization and comment ownership are checked by the Server Action.
// Lock the parent in the same statement as the comment/event write: a stale
// pre-check must not allow changes after the parent has been archived.
export async function setCommentArchived(input: {
  organizationId: string;
  entityType: ActivityEntityType;
  entityId: string;
  commentId: string;
  actorMemberId: string;
  expectedVersion: number;
  archive: boolean;
}): Promise<boolean> {
  const rows = await sql.query(`
    WITH writable_target AS (${writableCommentTargetSql(input.entityType)}), changed_comment AS (
      UPDATE comments SET is_archived = $3, version = version + 1, updated_at = now()
      FROM writable_target
      WHERE comments.id = $4::uuid AND comments.organization_id = $2::uuid
        AND comments.entity_type = $5 AND comments.entity_id = writable_target.id
        AND comments.version = $6 AND comments.is_archived <> $3
        AND comments.deleted_at IS NULL
      RETURNING comments.id
    )
    INSERT INTO activity_events (
      id, organization_id, entity_type, entity_id, actor_member_id,
      comment_id, event_type, summary
    )
    SELECT $7::uuid, $2::uuid, $5, $1::uuid, $8::uuid, changed_comment.id, $9, $10
    FROM changed_comment
    RETURNING id
  `, [
    input.entityId, input.organizationId, input.archive, input.commentId,
    input.entityType, input.expectedVersion, randomUUID(), input.actorMemberId,
    input.archive ? "comment.archived" : "comment.restored",
    input.archive ? "Комментарий архивирован" : "Комментарий восстановлен",
  ]);
  return rows.length > 0;
}
