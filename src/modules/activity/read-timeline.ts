import { decodeHistoryCursor, encodeHistoryCursor } from "./history-cursor";
import { and, desc, eq, inArray, isNull, notLike, sql } from "drizzle-orm";

import { db } from "@/db";
import { activityEvents, comments } from "@/db/activity-schema";
import { organizationMembers } from "@/db/schema";
import {
  getEntityReadPermission,
  type ActivityEntityType,
} from "./entity-types";

// The caller must resolve the current access context and validate the target.
// Filter before LIMIT so hidden events cannot crowd out visible task history.
export async function readTimelineRows({
  organizationId,
  entityType,
  entityId,
  permissions,
  cursor,
}: {
  organizationId: string;
  entityType: ActivityEntityType;
  entityId: string;
  permissions: ReadonlySet<string>;
  cursor?: string;
}) {
  const after = decodeHistoryCursor(cursor);
  const canReadEntity = permissions.has(getEntityReadPermission(entityType));
  const canReadComments = canReadEntity && permissions.has("comments.read");
  const canReadActivity = canReadEntity && permissions.has("activity.read");
  const canReadMembers = permissions.has("members.read");

  const eventQuery = db
    .select({
      id: activityEvents.id,
      actorMemberId: activityEvents.actorMemberId,
      actorDisplayName: canReadMembers
        ? organizationMembers.displayName
        : sql<string | null>`null`,
      commentId: activityEvents.commentId,
      eventType: activityEvents.eventType,
      summary: activityEvents.summary,
      details: activityEvents.details,
      createdAt: activityEvents.createdAt,
      cursorAt: sql<string>`to_char(${activityEvents.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
    })
    .from(activityEvents)
    .$dynamic();

  if (canReadActivity && canReadMembers) {
    eventQuery.leftJoin(
      organizationMembers,
      and(
        eq(activityEvents.actorMemberId, organizationMembers.id),
        eq(organizationMembers.organizationId, organizationId),
      ),
    );
  }

  const eventRows = canReadActivity
    ? await eventQuery
        .where(
          and(
            eq(activityEvents.organizationId, organizationId),
            eq(activityEvents.entityType, entityType),
            eq(activityEvents.entityId, entityId),
            after
              ? sql`(${activityEvents.createdAt},${activityEvents.id}) < (${after.at}::timestamptz,${after.id}::uuid)`
              : undefined,
            // Check both markers: deleted comments may have their FK set to null.
            canReadComments
              ? undefined
              : and(
                  isNull(activityEvents.commentId),
                  notLike(activityEvents.eventType, "comment.%"),
                ),
          ),
        )
        .orderBy(desc(activityEvents.createdAt), desc(activityEvents.id))
        .limit(51)
    : [];

  const commentQuery = db
    .select({
      id: comments.id,
      authorMemberId: comments.authorMemberId,
      authorDisplayName: canReadMembers
        ? organizationMembers.displayName
        : sql<string | null>`null`,
      body: comments.body,
      isArchived: comments.isArchived,
      version: comments.version,
      createdAt: comments.createdAt,
      cursorAt: sql<string>`to_char(${comments.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
      updatedAt: comments.updatedAt,
    })
    .from(comments)
    .$dynamic();

  if (canReadComments && canReadMembers) {
    commentQuery.leftJoin(
      organizationMembers,
      and(
        eq(comments.authorMemberId, organizationMembers.id),
        eq(organizationMembers.organizationId, organizationId),
      ),
    );
  }

  const commentRows = canReadComments
    ? await commentQuery
        .where(
          and(
            eq(comments.organizationId, organizationId),
            eq(comments.entityType, entityType),
            eq(comments.entityId, entityId),
            isNull(comments.deletedAt),
            canReadActivity
              ? inArray(
                  comments.id,
                  eventRows
                    .slice(0, 50)
                    .flatMap((event) =>
                      event.commentId ? [event.commentId] : [],
                    ),
                )
              : after
                ? sql`(${comments.createdAt},${comments.id}) < (${after.at}::timestamptz,${after.id}::uuid)`
                : undefined,
          ),
        )
        .orderBy(desc(comments.createdAt), desc(comments.id))
        .limit(canReadActivity ? 50 : 101)
    : [];

  const visibleEvents = eventRows.slice(0, 50),
    visibleComments = commentRows.slice(0, 100);
  const last = canReadActivity ? visibleEvents.at(-1) : visibleComments.at(-1);
  const more = canReadActivity
    ? eventRows.length > 50
    : commentRows.length > 100;
  return {
    eventRows: visibleEvents,
    commentRows: visibleComments,
    nextCursor:
      more && last
        ? encodeHistoryCursor({ id: last.id, at: last.cursorAt })
        : null,
  };
}
