"use server";

import {
  revalidatePath,
} from "next/cache";

import {
  requireMutationPermission,
} from "@/lib/auth/permissions";
import {
  transitionDeal,
} from "@/modules/deals/transition-deal";

export type MoveDealOnBoardResult =
  | {
      success: true;
    }
  | {
      success: false;
      message: string;
    };

export async function moveDealOnBoard(
  organizationScope: string,
  dealId: string,
  stageId: string,
  expectedVersion: number,
): Promise<MoveDealOnBoardResult> {
  const {
    organization,
  } = await requireMutationPermission(
    "deals.update",
    organizationScope,
  );

  try {
    const result =
      await transitionDeal({
        organizationId:
          organization.id,

        dealId,
        expectedVersion,

        targetStageId:
          stageId,
      });

    if (
      !result.success
    ) {
      return {
        success: false,
        message:
          result.message,
      };
    }

    revalidatePath(
      "/crm",
    );

    revalidatePath(
      "/crm/deals",
    );

    revalidatePath(
      `/crm/deals/${result.dealId}`,
    );

    return {
      success: true,
    };
  } catch (error) {
    console.error(
      "Failed to move deal on board:",
      error instanceof Error
        ? error.message
        : "Unknown error",
    );

    return {
      success: false,
      message:
        "Ошибка при перемещении сделки.",
    };
  }
}
