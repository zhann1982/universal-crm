import { db } from "@/db";
import {
  activityEvents,
} from "@/db/activity-schema";
import type {
  ActivityEntityType,
} from "./entity-types";

export type ActivityEventDraft = {
  eventType: string;
  summary: string;
  details?: string | null;
  commentId?: string | null;
};

export async function recordActivityEvents({
  organizationId,
  entityType,
  entityId,
  actorMemberId,
  events,
}: {
  organizationId: string;
  entityType: ActivityEntityType;
  entityId: string;
  actorMemberId: string | null;
  events: ActivityEventDraft[];
}) {
  if (events.length === 0) {
    return;
  }

  try {
    await db
      .insert(activityEvents)
      .values(
        events.map((event) => ({
          organizationId,
          entityType,
          entityId,
          actorMemberId,
          commentId:
            event.commentId ?? null,
          eventType:
            event.eventType,
          summary:
            event.summary,
          details:
            event.details ?? null,
        })),
      );
  } catch (error) {
    // Activity is useful product history, but a logging failure must not
    // roll back an otherwise successful CRM mutation at this stage.
    console.error(
      "Failed to record activity event:",
      error,
    );
  }
}
