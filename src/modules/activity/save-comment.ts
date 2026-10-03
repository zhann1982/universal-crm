import { randomUUID } from "node:crypto";
import { sql } from "@/db";
import type { ActivityEntityType } from "./entity-types";
import { writableCommentTargetSql } from "./comment-target";

// The Server Action checks the mutation scope, comment permission and parent read
// permission. Parent lifecycle, comment identity/version and authorship are also
// checked inside this atomic write, independently of earlier UX pre-checks.
export async function saveComment(input: {
  organizationId: string;
  entityType: ActivityEntityType;
  entityId: string;
  commentId: string;
  actorMemberId: string;
  body: string;
  expectedVersion: number | null;
  canManage: boolean;
}): Promise<boolean> {
  const create = input.expectedVersion === null;
  const mutation = create ? `
    INSERT INTO comments (id, organization_id, entity_type, entity_id, author_member_id, body)
    SELECT $3::uuid, $2::uuid, $4, writable_target.id, $5::uuid, $6
    FROM writable_target CROSS JOIN request
    WHERE request.expected_version IS NULL
    RETURNING id
  ` : `
    UPDATE comments SET body = $6, version = version + 1, updated_at = now()
    FROM writable_target CROSS JOIN request
    WHERE comments.id = $3::uuid AND comments.organization_id = $2::uuid
      AND comments.entity_type = $4 AND comments.entity_id = writable_target.id
      AND comments.version = request.expected_version AND comments.is_archived = false
      AND comments.deleted_at IS NULL
      AND (comments.author_member_id = $5::uuid OR request.can_manage)
    RETURNING comments.id
  `;
  const rows = await sql.query(`
    WITH request AS (SELECT $7::integer AS expected_version, $8::boolean AS can_manage),
    writable_target AS (${writableCommentTargetSql(input.entityType)}),
    changed_comment AS (${mutation})
    INSERT INTO activity_events (
      id, organization_id, entity_type, entity_id, actor_member_id,
      comment_id, event_type, summary, details
    )
    SELECT $9::uuid, $2::uuid, $4, $1::uuid, $5::uuid, changed_comment.id,
      $10, $11, $6
    FROM changed_comment
    RETURNING id
  `, [
    input.entityId, input.organizationId, input.commentId, input.entityType,
    input.actorMemberId, input.body, input.expectedVersion, input.canManage,
    randomUUID(), create ? "comment.created" : "comment.updated",
    create ? "Добавлен комментарий" : "Комментарий изменён",
  ]);
  return rows.length > 0;
}
