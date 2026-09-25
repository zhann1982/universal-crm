"use server";

import {
  and,
  eq,
  isNull,
} from "drizzle-orm";
import {
  revalidatePath,
} from "next/cache";
import {
  redirect,
} from "next/navigation";

import { db } from "@/db";
import {
  companies,
  deals,
  organizationMembers,
  pipelineStages,
  pipelines,
} from "@/db/schema";
import {
  requirePermission,
} from "@/lib/auth/permissions";
import {
  createDealSchema,
  type CreateDealState,
} from "@/lib/validation/deal";

function getFormValues(
  formData: FormData,
) {
  return {
    title: String(
      formData.get("title") ??
        "",
    ),

    pipelineId: String(
      formData.get(
        "pipelineId",
      ) ?? "",
    ),

    stageId: String(
      formData.get("stageId") ??
        "",
    ),

    amount: String(
      formData.get("amount") ??
        "",
    ),

    currency: String(
      formData.get("currency") ??
        "",
    ),

    companyId: String(
      formData.get("companyId") ??
        "",
    ),

    ownerMemberId: String(
      formData.get(
        "ownerMemberId",
      ) ?? "",
    ),

    expectedCloseAt: String(
      formData.get(
        "expectedCloseAt",
      ) ?? "",
    ),

    notes: String(
      formData.get("notes") ??
        "",
    ),
  };
}

export async function createDeal(
  _previousState:
    CreateDealState,

  formData: FormData,
): Promise<CreateDealState> {
  const {
    organization,
    member,
    permissions,
  } = await requirePermission(
    "deals.create",
  );

  if (
    !permissions.has(
      "pipelines.read",
    )
  ) {
    redirect(
      "/crm/forbidden",
    );
  }

  const values =
    getFormValues(
      formData,
    );

  const result =
    createDealSchema.safeParse(
      values,
    );

  if (!result.success) {
    return {
      values,

      errors:
        result.error.flatten()
          .fieldErrors,

      message:
        "Проверьте данные формы.",
    };
  }

  const data =
    result.data;

  /*
   * Pipeline
   */

  const [pipeline] =
    await db
      .select({
        id:
          pipelines.id,
      })
      .from(pipelines)
      .where(
        and(
          eq(
            pipelines.id,
            data.pipelineId,
          ),

          eq(
            pipelines.organizationId,
            organization.id,
          ),

          eq(
            pipelines.isArchived,
            false,
          ),
        ),
      )
      .limit(1);

  if (!pipeline) {
    return {
      values,

      errors: {
        pipelineId: [
          "Выбранная воронка недоступна.",
        ],
      },

      message:
        "Проверьте данные формы.",
    };
  }

  /*
   * Stage
   *
   * Здесь принципиально проверяем,
   * что stage относится именно
   * к выбранной pipeline.
   */

  const [stage] =
    await db
      .select({
        id:
          pipelineStages.id,

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
            data.stageId,
          ),

          eq(
            pipelineStages.organizationId,
            organization.id,
          ),

          eq(
            pipelineStages.pipelineId,
            pipeline.id,
          ),
        ),
      )
      .limit(1);

  if (!stage) {
    return {
      values,

      errors: {
        stageId: [
          "Этап не относится к выбранной воронке.",
        ],
      },

      message:
        "Проверьте данные формы.",
    };
  }

  /*
   * Company
   */

  if (
    data.companyId
  ) {
    if (
      !permissions.has(
        "companies.read",
      )
    ) {
      return {
        values,

        errors: {
          companyId: [
            "Нет доступа к компаниям.",
          ],
        },

        message:
          "Проверьте данные формы.",
      };
    }

    const [company] =
      await db
        .select({
          id:
            companies.id,
        })
        .from(companies)
        .where(
          and(
            eq(
              companies.id,
              data.companyId,
            ),

            eq(
              companies.organizationId,
              organization.id,
            ),

            eq(
              companies.isArchived,
              false,
            ),

            isNull(
              companies.deletedAt,
            ),
          ),
        )
        .limit(1);

    if (!company) {
      return {
        values,

        errors: {
          companyId: [
            "Выбранная компания недоступна.",
          ],
        },

        message:
          "Проверьте данные формы.",
      };
    }
  }

  /*
   * Owner
   */

  if (
    data.ownerMemberId
  ) {
    /*
     * Пользователь без members.read
     * может назначить сделку только
     * самому себе.
     */
    if (
      !permissions.has(
        "members.read",
      ) &&
      data.ownerMemberId !==
        member.id
    ) {
      return {
        values,

        errors: {
          ownerMemberId: [
            "Нельзя назначить этого сотрудника.",
          ],
        },

        message:
          "Проверьте данные формы.",
      };
    }

    const [owner] =
      await db
        .select({
          id:
            organizationMembers.id,
        })
        .from(
          organizationMembers,
        )
        .where(
          and(
            eq(
              organizationMembers.id,
              data.ownerMemberId,
            ),

            eq(
              organizationMembers.organizationId,
              organization.id,
            ),

            eq(
              organizationMembers.status,
              "active",
            ),
          ),
        )
        .limit(1);

    if (!owner) {
      return {
        values,

        errors: {
          ownerMemberId: [
            "Ответственный сотрудник недоступен.",
          ],
        },

        message:
          "Проверьте данные формы.",
      };
    }
  }

  let expectedCloseAt:
    | Date
    | null = null;

  if (
    data.expectedCloseAt
  ) {
    expectedCloseAt =
      new Date(
        `${data.expectedCloseAt}T12:00:00.000Z`,
      );
  }

  const isClosed =
    stage.type === "won" ||
    stage.type === "lost";

  try {
    await db
      .insert(deals)
      .values({
        organizationId:
          organization.id,

        pipelineId:
          pipeline.id,

        stageId:
          stage.id,

        ownerMemberId:
          data.ownerMemberId,

        companyId:
          data.companyId,

        title:
          data.title,

        amount:
          data.amount,

        currency:
          data.currency,

        expectedCloseAt,

        closedAt:
          isClosed
            ? new Date()
            : null,

        notes:
          data.notes,
      });
  } catch (error) {
    console.error(
      "Failed to create deal:",
      error,
    );

    return {
      values,

      message:
        "Не удалось создать сделку. Попробуйте ещё раз.",
    };
  }

  revalidatePath(
    "/crm",
  );

  revalidatePath(
    "/crm/deals",
  );

  redirect(
    `/crm/deals?pipeline=${pipeline.id}`,
  );
}