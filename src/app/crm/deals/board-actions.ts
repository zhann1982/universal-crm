"use server";

import {
  revalidatePath,
} from "next/cache";

import {
  requirePermission,
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
  dealId: string,
  stageId: string,
): Promise<MoveDealOnBoardResult> {
  const {
    organization,
  } = await requirePermission(
    "deals.update",
  );

  try {
    const result =
      await transitionDeal({
        organizationId:
          organization.id,

        dealId,

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