import {
  and,
  eq,
  isNull,
} from "drizzle-orm";

import { db } from "@/db";
import {
  companies,
  deals,
  organizationMembers,
  pipelines,
  pipelineStages,
} from "@/db/schema";
import {
  getCurrentOrganization,
} from "@/lib/current-organization";

export async function getDealById(
  dealId: string,
) {
  const organization =
    await getCurrentOrganization();

  const [deal] =
    await db
      .select({
        id:
          deals.id,

        organizationId:
          deals.organizationId,

        pipelineId:
          deals.pipelineId,

        pipelineName:
          pipelines.name,

        stageId:
          deals.stageId,

        stageName:
          pipelineStages.name,

        stageType:
          pipelineStages.type,

        stageProbability:
          pipelineStages.probability,

        ownerMemberId:
          deals.ownerMemberId,

        ownerDisplayName:
          organizationMembers.displayName,

        ownerEmail:
          organizationMembers.email,

        companyId:
          deals.companyId,

        companyName:
          companies.name,

        title:
          deals.title,

        amount:
          deals.amount,

        currency:
          deals.currency,

        expectedCloseAt:
          deals.expectedCloseAt,

        closedAt:
          deals.closedAt,

        notes:
          deals.notes,

        isArchived:
          deals.isArchived,

        createdAt:
          deals.createdAt,

        updatedAt:
          deals.updatedAt,
      })
      .from(deals)
      .innerJoin(
        pipelines,
        and(
          eq(
            deals.pipelineId,
            pipelines.id,
          ),

          eq(
            pipelines.organizationId,
            organization.id,
          ),
        ),
      )
      .innerJoin(
        pipelineStages,
        and(
          eq(
            deals.stageId,
            pipelineStages.id,
          ),

          eq(
            pipelineStages.organizationId,
            organization.id,
          ),
        ),
      )
      .leftJoin(
        companies,
        and(
          eq(
            deals.companyId,
            companies.id,
          ),

          eq(
            companies.organizationId,
            organization.id,
          ),

          isNull(
            companies.deletedAt,
          ),
        ),
      )
      .leftJoin(
        organizationMembers,
        and(
          eq(
            deals.ownerMemberId,
            organizationMembers.id,
          ),

          eq(
            organizationMembers.organizationId,
            organization.id,
          ),
        ),
      )
      .where(
        and(
          eq(
            deals.id,
            dealId,
          ),

          eq(
            deals.organizationId,
            organization.id,
          ),

          isNull(
            deals.deletedAt,
          ),
        ),
      )
      .limit(1);

  return deal ?? null;
}