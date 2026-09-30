import { and, desc, eq, isNull, notLike, sql } from "drizzle-orm";

import { db } from "@/db";
import { activityEvents, comments } from "@/db/activity-schema";
import { organizationMembers } from "@/db/schema";
import { getEntityReadPermission, type ActivityEntityType } from "./entity-types";

// The caller must resolve the current access context and validate the target.
// Filter before LIMIT so hidden events cannot crowd out visible task history.
export async function readTimelineRows({
  organizationId,
  entityType,
  entityId,
  permissions,
}: {
  organizationId: string;
  entityType: ActivityEntityType;
  entityId: string;
  permissions: ReadonlySet<string>;
}) {
  const canReadEntity = permissions.has(getEntityReadPermission(entityType));
  const canReadComments = canReadEntity && permissions.has("comments.read");
  const canReadActivity = canReadEntity && permissions.has("activity.read");
  const canReadMembers = permissions.has("members.read");

  const eventQuery = db.select({
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
  }).from(activityEvents).$dynamic();

  if (canReadActivity && canReadMembers) {
    eventQuery.leftJoin(organizationMembers, and(
      eq(activityEvents.actorMemberId, organizationMembers.id),
      eq(organizationMembers.organizationId, organizationId),
    ));
  }

  const eventRows = canReadActivity ? await eventQuery.where(and(
    eq(activityEvents.organizationId, organizationId),
    eq(activityEvents.entityType, entityType),
    eq(activityEvents.entityId, entityId),
    // Check both markers: deleted comments may have their FK set to null.
    canReadComments ? undefined : and(
      isNull(activityEvents.commentId),
      notLike(activityEvents.eventType, "comment.%"),
    ),
  )).orderBy(desc(activityEvents.createdAt), desc(activityEvents.id)).limit(50) : [];

  const commentQuery = db.select({
    id: comments.id,
    authorMemberId: comments.authorMemberId,
    authorDisplayName: canReadMembers
      ? organizationMembers.displayName
      : sql<string | null>`null`,
    body: comments.body,
    isArchived: comments.isArchived,
    version: comments.version,
    createdAt: comments.createdAt,
    updatedAt: comments.updatedAt,
  }).from(comments).$dynamic();

  if (canReadComments && canReadMembers) {
    commentQuery.leftJoin(organizationMembers, and(
      eq(comments.authorMemberId, organizationMembers.id),
      eq(organizationMembers.organizationId, organizationId),
    ));
  }

  const commentRows = canReadComments ? await commentQuery.where(and(
    eq(comments.organizationId, organizationId),
    eq(comments.entityType, entityType),
    eq(comments.entityId, entityId),
    isNull(comments.deletedAt),
  )).orderBy(desc(comments.createdAt), desc(comments.id)).limit(100) : [];

  return { eventRows, commentRows };
}
