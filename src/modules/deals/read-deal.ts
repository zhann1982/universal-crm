import { and, eq, getTableColumns, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { deals, pipelines, pipelineStages } from "@/db/schema";
import { dealReferenceFields } from "./list-filter";

// Context comes from the verified server access chain, never browser identity.
export async function readDealDetails(
  dealId: string,
  context: {
    organizationId: string;
    memberId: string;
    memberDisplayName: string | null;
    permissions: ReadonlySet<string>;
  },
) {
  if (
    !context.permissions.has("deals.read") ||
    !context.permissions.has("pipelines.read")
  )
    return null;
  const references = dealReferenceFields(
    context.permissions,
    context.organizationId,
  );
  const [deal] = await db
    .select({
      ...getTableColumns(deals),
      pipelineName: pipelines.name,
      stageName: pipelineStages.name,
      stageType: pipelineStages.type,
      stageProbability: pipelineStages.probability,
      companyName: references.companyName,
      ownerDisplayName: context.permissions.has("members.read")
        ? references.ownerDisplayName
        : sql<
            string | null
          >`CASE WHEN ${deals.ownerMemberId}=${context.memberId} THEN ${context.memberDisplayName} ELSE NULL END`,
    })
    .from(deals)
    .innerJoin(
      pipelines,
      and(
        eq(deals.pipelineId, pipelines.id),
        eq(pipelines.organizationId, context.organizationId),
      ),
    )
    .innerJoin(
      pipelineStages,
      and(
        eq(deals.stageId, pipelineStages.id),
        eq(pipelineStages.organizationId, context.organizationId),
        eq(pipelineStages.pipelineId, deals.pipelineId),
      ),
    )
    .where(
      and(
        eq(deals.id, dealId),
        eq(deals.organizationId, context.organizationId),
        isNull(deals.deletedAt),
      ),
    )
    .limit(1);
  return deal ?? null;
}
