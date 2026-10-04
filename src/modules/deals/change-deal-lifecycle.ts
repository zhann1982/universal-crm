import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { deals } from "@/db/schema";
import { dealIdSchema, dealVersionSchema } from "@/lib/validation/deal";
import { recordMutation } from "@/modules/activity/mutation-context";
export async function changeDealLifecycle(input: {
  organizationId: string;
  memberId: string;
  dealId: string;
  expectedVersion: number;
  archive: boolean;
}) {
  if (
    !dealIdSchema.safeParse(input.dealId).success ||
    !dealVersionSchema.safeParse(input.expectedVersion).success
  )
    return null;
  try {
    const [changed] = await recordMutation(
      { organizationId: input.organizationId, memberId: input.memberId },
      () =>
        db
          .update(deals)
          .set({
            isArchived: input.archive,
            version: sql`${deals.version}+1`,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(deals.id, input.dealId),
              eq(deals.organizationId, input.organizationId),
              eq(deals.version, input.expectedVersion),
              eq(deals.isArchived, !input.archive),
              isNull(deals.deletedAt),
            ),
          )
          .returning({
            id: deals.id,
            version: deals.version,
            pipelineId: deals.pipelineId,
          }),
    );
    return changed ?? null;
  } catch (error) {
    const failure = error as { code?: string; cause?: { code?: string } };
    if ((failure.cause?.code ?? failure.code) === "23514") return null;
    throw error;
  }
}
