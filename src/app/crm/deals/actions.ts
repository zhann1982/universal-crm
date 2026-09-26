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
  dealIdSchema,
  updateDealSchema,
  type UpdateDealState,
  type CreateDealState,
} from "@/lib/validation/deal";
import {
  transitionDeal,
} from "@/modules/deals/transition-deal";

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

export async function moveDealToStage(
  dealId: string,
  formData: FormData,
) {
  const {
    organization,
  } = await requirePermission(
    "deals.update",
  );

  const stageId =
    String(
      formData.get(
        "stageId",
      ) ?? "",
    );

  let result:
    Awaited<
      ReturnType<
        typeof transitionDeal
      >
    >;

  try {
    result =
      await transitionDeal({
        organizationId:
          organization.id,

        dealId,

        targetStageId:
          stageId,
      });
  } catch (error) {
    console.error(
      "Failed to transition deal:",
      error instanceof Error
        ? error.message
        : "Unknown error",
    );

    redirect(
      `/crm/deals/${dealId}?error=stage-error`,
    );
  }

  if (
    !result.success
  ) {
    if (
      result.code ===
      "conflict"
    ) {
      redirect(
        `/crm/deals/${dealId}?error=stage-conflict`,
      );
    }

    if (
      result.code ===
        "deal-not-found" ||
      result.code ===
        "stage-not-found" ||
      result.code ===
        "invalid-stage-type"
    ) {
      redirect(
        "/crm/forbidden",
      );
    }

    redirect(
      "/crm/deals",
    );
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

  redirect(
    `/crm/deals/${result.dealId}`,
  );
}

export async function updateDeal(
  dealId: string,
  _previousState:
    UpdateDealState,
  formData: FormData,
): Promise<UpdateDealState> {
  const {
    organization,
    member,
    permissions,
  } = await requirePermission(
    "deals.update",
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

  const idResult =
    dealIdSchema.safeParse(
      dealId,
    );

  if (!idResult.success) {
    redirect(
      "/crm/deals",
    );
  }

  const values =
    getFormValues(
      formData,
    );

  const result =
    updateDealSchema.safeParse(
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

  const [existingDeal] =
    await db
      .select({
        id:
          deals.id,

        pipelineId:
          deals.pipelineId,

        stageId:
          deals.stageId,

        companyId:
          deals.companyId,

        ownerMemberId:
          deals.ownerMemberId,

        closedAt:
          deals.closedAt,
      })
      .from(deals)
      .where(
        and(
          eq(
            deals.id,
            idResult.data,
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

  if (!existingDeal) {
    redirect(
      "/crm/forbidden",
    );
  }

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
   * Stage обязательно должен
   * принадлежать выбранной Pipeline.
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

  if (data.companyId) {
    const companyChanged =
      data.companyId !==
      existingDeal.companyId;

    if (
      companyChanged &&
      !permissions.has(
        "companies.read",
      )
    ) {
      return {
        values,

        errors: {
          companyId: [
            "Нет доступа для изменения компании.",
          ],
        },

        message:
          "Проверьте данные формы.",
      };
    }

    const conditions = [
      eq(
        companies.id,
        data.companyId,
      ),

      eq(
        companies.organizationId,
        organization.id,
      ),

      isNull(
        companies.deletedAt,
      ),
    ];

    if (companyChanged) {
      conditions.push(
        eq(
          companies.isArchived,
          false,
        ),
      );
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
            ...conditions,
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
   * Responsible member
   */

  if (
    data.ownerMemberId
  ) {
    const ownerChanged =
      data.ownerMemberId !==
      existingDeal.ownerMemberId;

    if (
      ownerChanged &&
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

    const conditions = [
      eq(
        organizationMembers.id,
        data.ownerMemberId,
      ),

      eq(
        organizationMembers.organizationId,
        organization.id,
      ),
    ];

    if (ownerChanged) {
      conditions.push(
        eq(
          organizationMembers.status,
          "active",
        ),
      );
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
            ...conditions,
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

  const targetIsClosed =
    stage.type === "won" ||
    stage.type === "lost";

  const closedAt =
    targetIsClosed
      ? existingDeal.closedAt ??
        new Date()
      : null;

  try {
    await db
      .update(deals)
      .set({
        pipelineId:
          pipeline.id,

        stageId:
          stage.id,

        title:
          data.title,

        amount:
          data.amount,

        currency:
          data.currency,

        companyId:
          data.companyId,

        ownerMemberId:
          data.ownerMemberId,

        expectedCloseAt,

        closedAt,

        notes:
          data.notes,

        updatedAt:
          new Date(),
      })
      .where(
        and(
          eq(
            deals.id,
            existingDeal.id,
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
      );
  } catch (error) {
    console.error(
      "Failed to update deal:",
      error,
    );

    return {
      values,

      message:
        "Не удалось сохранить изменения.",
    };
  }

  revalidatePath(
    "/crm",
  );

  revalidatePath(
    "/crm/deals",
  );

  revalidatePath(
    `/crm/deals/${existingDeal.id}`,
  );

  redirect(
    `/crm/deals/${existingDeal.id}`,
  );
}

export async function archiveDeal(
  dealId: string,
) {
  const {
    organization,
  } = await requirePermission(
    "deals.archive",
  );

  const idResult =
    dealIdSchema.safeParse(
      dealId,
    );

  if (!idResult.success) {
    redirect(
      "/crm/deals",
    );
  }

  const [deal] =
    await db
      .select({
        id:
          deals.id,

        pipelineId:
          deals.pipelineId,
      })
      .from(deals)
      .where(
        and(
          eq(
            deals.id,
            idResult.data,
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
    redirect(
      "/crm/deals",
    );
  }

  await db
    .update(deals)
    .set({
      isArchived: true,

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
          deals.isArchived,
          false,
        ),

        isNull(
          deals.deletedAt,
        ),
      ),
    );

  revalidatePath(
    "/crm",
  );

  revalidatePath(
    "/crm/deals",
  );

  revalidatePath(
    "/crm/deals/archive",
  );

  revalidatePath(
    `/crm/deals/${deal.id}`,
  );

  redirect(
    `/crm/deals?pipeline=${deal.pipelineId}`,
  );
}

export async function restoreDeal(
  dealId: string,
) {
  const {
    organization,
  } = await requirePermission(
    "deals.archive",
  );

  const idResult =
    dealIdSchema.safeParse(
      dealId,
    );

  if (!idResult.success) {
    redirect(
      "/crm/deals/archive",
    );
  }

  const [deal] =
    await db
      .select({
        id:
          deals.id,
      })
      .from(deals)
      .where(
        and(
          eq(
            deals.id,
            idResult.data,
          ),

          eq(
            deals.organizationId,
            organization.id,
          ),

          eq(
            deals.isArchived,
            true,
          ),

          isNull(
            deals.deletedAt,
          ),
        ),
      )
      .limit(1);

  if (!deal) {
    redirect(
      "/crm/deals/archive",
    );
  }

  await db
    .update(deals)
    .set({
      isArchived: false,

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
          deals.isArchived,
          true,
        ),

        isNull(
          deals.deletedAt,
        ),
      ),
    );

  revalidatePath(
    "/crm",
  );

  revalidatePath(
    "/crm/deals",
  );

  revalidatePath(
    "/crm/deals/archive",
  );

  revalidatePath(
    `/crm/deals/${deal.id}`,
  );

  redirect(
    `/crm/deals/${deal.id}`,
  );
}