"use server";

import {
  and,
  eq,
  isNull,
} from "drizzle-orm";
import {
  revalidatePath,
} from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import {
  deals,
  pipelineStages,
} from "@/db/schema";
import {
  requirePermission,
} from "@/lib/auth/permissions";

const idSchema =
  z.string().uuid();

export type MoveDealOnBoardResult =
  | {
      success: true;
    }
  | {
      success: false;
      message: string;
    };

export async function moveDealOnBoard(
  dealId: string,
  stageId: string,
): Promise<MoveDealOnBoardResult> {
  const {
    organization,
  } = await requirePermission(
    "deals.update",
  );

  const dealIdResult =
    idSchema.safeParse(
      dealId,
    );

  const stageIdResult =
    idSchema.safeParse(
      stageId,
    );

  if (
    !dealIdResult.success ||
    !stageIdResult.success
  ) {
    return {
      success: false,
      message:
        "Некорректный идентификатор сделки или этапа.",
    };
  }

  const [deal] =
    await db
      .select({
        id:
          deals.id,

        pipelineId:
          deals.pipelineId,

        stageId:
          deals.stageId,

        closedAt:
          deals.closedAt,
      })
      .from(deals)
      .where(
        and(
          eq(
            deals.id,
            dealIdResult.data,
          ),

          eq(
            deals.organizationId,
            organization.id,
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

  if (!deal) {
    return {
      success: false,
      message:
        "Сделка не найдена или недоступна.",
    };
  }

  if (
    deal.stageId ===
    stageIdResult.data
  ) {
    return {
      success: true,
    };
  }

  const [targetStage] =
    await db
      .select({
        id:
          pipelineStages.id,

        type:
          pipelineStages.type,

        pipelineId:
          pipelineStages.pipelineId,
      })
      .from(
        pipelineStages,
      )
      .where(
        and(
          eq(
            pipelineStages.id,
            stageIdResult.data,
          ),

          eq(
            pipelineStages.organizationId,
            organization.id,
          ),

          eq(
            pipelineStages.pipelineId,
            deal.pipelineId,
          ),
        ),
      )
      .limit(1);

  if (!targetStage) {
    return {
      success: false,
      message:
        "Целевой этап недоступен или относится к другой воронке.",
    };
  }

  const targetIsClosed =
    targetStage.type ===
      "won" ||
    targetStage.type ===
      "lost";

  const closedAt =
    targetIsClosed
      ? deal.closedAt ??
        new Date()
      : null;

  try {
    const updated =
      await db
        .update(deals)
        .set({
          stageId:
            targetStage.id,

          closedAt,

          updatedAt:
            new Date(),
        })
        .where(
          and(
            eq(
              deals.id,
              deal.id,
            ),

            eq(
              deals.organizationId,
              organization.id,
            ),

            eq(
              deals.pipelineId,
              targetStage.pipelineId,
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
        .returning({
          id:
            deals.id,
        });

    if (
      updated.length === 0
    ) {
      return {
        success: false,
        message:
          "Не удалось переместить сделку.",
      };
    }
  } catch (error) {
    console.error(
      "Failed to move deal on board:",
      error,
    );

    return {
      success: false,
      message:
        "Ошибка при перемещении сделки.",
    };
  }

  revalidatePath(
    "/crm",
  );

  revalidatePath(
    "/crm/deals",
  );

  revalidatePath(
    `/crm/deals/${deal.id}`,
  );

  return {
    success: true,
  };
}