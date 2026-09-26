import {
  and,
  eq,
  isNull,
} from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import {
  deals,
  pipelineStages,
} from "@/db/schema";

const idSchema =
  z.string().uuid();

const stageTypeSchema =
  z.enum([
    "open",
    "won",
    "lost",
  ]);

export type TransitionDealResult =
  | {
      success: true;

      dealId: string;
      pipelineId: string;
      stageId: string;
    }
  | {
      success: false;

      code:
        | "invalid-input"
        | "deal-not-found"
        | "stage-not-found"
        | "invalid-stage-type"
        | "conflict";

      message: string;
    };

type TransitionDealInput = {
  organizationId: string;
  dealId: string;
  targetStageId: string;
};

export async function transitionDeal({
  organizationId,
  dealId,
  targetStageId,
}: TransitionDealInput): Promise<TransitionDealResult> {
  const dealIdResult =
    idSchema.safeParse(
      dealId,
    );

  const stageIdResult =
    idSchema.safeParse(
      targetStageId,
    );

  if (
    !dealIdResult.success ||
    !stageIdResult.success
  ) {
    return {
      success: false,

      code:
        "invalid-input",

      message:
        "Некорректный идентификатор сделки или этапа.",
    };
  }

  /*
   * Читаем текущее состояние Deal.
   *
   * version, pipelineId и stageId
   * становятся ожидаемым исходным
   * состоянием для условного UPDATE.
   */
  const [deal] =
    await db
      .select({
        id:
          deals.id,

        version:
          deals.version,

        pipelineId:
          deals.pipelineId,

        stageId:
          deals.stageId,

        closedAt:
          deals.closedAt,
      })
      .from(
        deals,
      )
      .where(
        and(
          eq(
            deals.id,
            dealIdResult.data,
          ),

          eq(
            deals.organizationId,
            organizationId,
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

      code:
        "deal-not-found",

      message:
        "Сделка не найдена или недоступна.",
    };
  }

  /*
   * Target Stage должен принадлежать:
   *
   * - той же Organization
   * - текущей Pipeline сделки
   */
  const [targetStage] =
    await db
      .select({
        id:
          pipelineStages.id,

        pipelineId:
          pipelineStages.pipelineId,

        type:
          pipelineStages.type,
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
            organizationId,
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

      code:
        "stage-not-found",

      message:
        "Этап недоступен или относится к другой воронке.",
    };
  }

  const stageTypeResult =
    stageTypeSchema.safeParse(
      targetStage.type,
    );

  if (
    !stageTypeResult.success
  ) {
    return {
      success: false,

      code:
        "invalid-stage-type",

      message:
        "У этапа указан неизвестный тип.",
    };
  }

  /*
   * Сделка уже находится
   * на выбранном этапе.
   *
   * Реальной мутации нет,
   * поэтому version не меняем.
   */
  if (
    deal.stageId ===
    targetStage.id
  ) {
    return {
      success: true,

      dealId:
        deal.id,

      pipelineId:
        deal.pipelineId,

      stageId:
        deal.stageId,
    };
  }

  const targetIsClosed =
    stageTypeResult.data ===
      "won" ||
    stageTypeResult.data ===
      "lost";

  const closedAt =
    targetIsClosed
      ? deal.closedAt ??
        new Date()
      : null;

  /*
   * Optimistic locking +
   * защита Pipeline/Stage.
   *
   * UPDATE пройдёт только если
   * после SELECT никто не изменил:
   *
   * - version
   * - pipelineId
   * - stageId
   * - lifecycle state
   */
  const updated =
    await db
      .update(
        deals,
      )
      .set({
        stageId:
          targetStage.id,

        closedAt,

        /*
         * Каждая успешная
         * мутация Deal должна
         * увеличивать version.
         */
        version:
          deal.version + 1,

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
            organizationId,
          ),

          eq(
            deals.version,
            deal.version,
          ),

          eq(
            deals.pipelineId,
            deal.pipelineId,
          ),

          eq(
            deals.stageId,
            deal.stageId,
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

        pipelineId:
          deals.pipelineId,

        stageId:
          deals.stageId,

        version:
          deals.version,
      });

  /*
   * Если UPDATE изменил 0 строк,
   * значит состояние Deal успело
   * измениться параллельно.
   */
  if (
    updated.length === 0
  ) {
    return {
      success: false,

      code:
        "conflict",

      message:
        "Сделка уже была изменена другим действием. Обновите данные и повторите попытку.",
    };
  }

  return {
    success: true,

    dealId:
      updated[0].id,

    pipelineId:
      updated[0].pipelineId,

    stageId:
      updated[0].stageId,
  };
}