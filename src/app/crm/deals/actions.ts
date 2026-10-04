"use server";
import { creationValues } from "@/modules/custom-fields/persistence";
import { changeDealLifecycle } from "@/modules/deals/change-deal-lifecycle";

import { redirectWithNotice } from "@/modules/notifications/redirect";

import { and, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { recordMutation } from "@/modules/activity/mutation-context";
import { companies, deals, pipelineStages, pipelines } from "@/db/schema";
import { requireMutationPermission } from "@/lib/auth/permissions";
import {
  createDealSchema,
  dealIdSchema,
  dealVersionSchema,
  updateDealSchema,
  type CreateDealState,
  type UpdateDealState,
} from "@/lib/validation/deal";
import { transitionDeal } from "@/modules/deals/transition-deal";
import { resolveOwnerAssignment } from "@/modules/members/owner-assignment";

function getFormValues(formData: FormData) {
  return {
    title: String(formData.get("title") ?? ""),

    pipelineId: String(formData.get("pipelineId") ?? ""),

    stageId: String(formData.get("stageId") ?? ""),

    amount: String(formData.get("amount") ?? ""),

    currency: String(formData.get("currency") ?? ""),

    companyId: String(formData.get("companyId") ?? ""),

    ownerMemberId: String(formData.get("ownerMemberId") ?? ""),

    expectedCloseAt: String(formData.get("expectedCloseAt") ?? ""),

    notes: String(formData.get("notes") ?? ""),
  };
}

export async function createDeal(
  _previousState: CreateDealState,

  formData: FormData,
): Promise<CreateDealState> {
  const { organization, member, permissions } = await requireMutationPermission(
    "deals.create",
    formData,
  );

  if (!permissions.has("pipelines.read")) {
    redirect("/crm/forbidden");
  }

  const values = getFormValues(formData);

  const result = createDealSchema.safeParse(values);

  if (!result.success) {
    return {
      values,

      errors: result.error.flatten().fieldErrors,

      message: "Проверьте данные формы.",
    };
  }

  const data = result.data;

  /*
   * Pipeline
   */

  const [pipeline] = await db
    .select({
      id: pipelines.id,
    })
    .from(pipelines)
    .where(
      and(
        eq(pipelines.id, data.pipelineId),

        eq(pipelines.organizationId, organization.id),

        eq(pipelines.isArchived, false),
      ),
    )
    .limit(1);

  if (!pipeline) {
    return {
      values,

      errors: {
        pipelineId: ["Выбранная воронка недоступна."],
      },

      message: "Проверьте данные формы.",
    };
  }

  /*
   * Stage
   */

  const [stage] = await db
    .select({
      id: pipelineStages.id,

      type: pipelineStages.type,
    })
    .from(pipelineStages)
    .where(
      and(
        eq(pipelineStages.id, data.stageId),

        eq(pipelineStages.organizationId, organization.id),

        eq(pipelineStages.pipelineId, pipeline.id),
      ),
    )
    .limit(1);

  if (!stage) {
    return {
      values,

      errors: {
        stageId: ["Этап не относится к выбранной воронке."],
      },

      message: "Проверьте данные формы.",
    };
  }

  /*
   * Company
   */

  if (data.companyId) {
    if (!permissions.has("companies.read")) {
      return {
        values,

        errors: {
          companyId: ["Нет доступа к компаниям."],
        },

        message: "Проверьте данные формы.",
      };
    }

    const [company] = await db
      .select({
        id: companies.id,
      })
      .from(companies)
      .where(
        and(
          eq(companies.id, data.companyId),

          eq(companies.organizationId, organization.id),

          eq(companies.isArchived, false),

          isNull(companies.deletedAt),
        ),
      )
      .limit(1);

    if (!company) {
      return {
        values,

        errors: {
          companyId: ["Выбранная компания недоступна."],
        },

        message: "Проверьте данные формы.",
      };
    }
  }

  /*
   * Responsible Member.
   *
   * F05:
   * without members.read only self/null
   * is allowed.
   *
   * Every new non-null owner must also
   * be an active Member of this tenant.
   */
  const ownerResult = await resolveOwnerAssignment({
    organizationId: organization.id,

    mode: "create",

    currentMemberId: member.id,

    canReadMembers: permissions.has("members.read"),

    requestedOwnerMemberId: data.ownerMemberId,
  });

  if (ownerResult.status === "forbidden") {
    return {
      values,

      errors: {
        ownerMemberId: ["Нельзя назначить этого сотрудника."],
      },

      message: "Проверьте данные формы.",
    };
  }

  if (ownerResult.status === "owner-unavailable") {
    return {
      values,

      errors: {
        ownerMemberId: ["Ответственный сотрудник недоступен."],
      },

      message: "Проверьте данные формы.",
    };
  }

  const expectedCloseAt = data.expectedCloseAt;

  const isClosed = stage.type === "won" || stage.type === "lost";

  let customData;
  try {
    customData = await creationValues(organization.id, "deal", formData);
  } catch (error) {
    const known = error instanceof Error && !("code" in error) &&
      /^(Заполните поле|Поле «|Настройка полей|Неизвестное поле|Некорректные значения)/.test(error.message);
    return {
      values,
      message: known ? error.message : "Не удалось проверить пользовательские поля.",
    };
  }
  try {
    await recordMutation(
      { organizationId: organization.id, memberId: member.id },
      () =>
        db.insert(deals).values({
      ...customData,
          organizationId: organization.id,

          pipelineId: pipeline.id,

          stageId: stage.id,

          ownerMemberId: data.ownerMemberId,

          companyId: data.companyId,

          title: data.title,

          amount: data.amount,

          currency: data.currency,

          expectedCloseAt,

          closedAt: isClosed ? new Date() : null,

          notes: data.notes,
        }),
    );
  } catch (error) {
    console.error("Failed to create deal:", error);

    return {
      values,

      message: "Не удалось создать сделку. Попробуйте ещё раз.",
    };
  }

  revalidatePath("/crm");

  revalidatePath("/crm/deals");

  redirectWithNotice(`/crm/deals?pipeline=${pipeline.id}`, "deal-created");
}

export async function moveDealToStage(dealId: string, formData: FormData) {
  const { organization, member } = await requireMutationPermission(
    "deals.update",
    formData,
  );

  const versionResult = dealVersionSchema.safeParse(formData.get("version"));

  if (!versionResult.success) {
    redirect(`/crm/deals/${dealId}?error=stage-conflict`);
  }

  const stageId = String(formData.get("stageId") ?? "");

  let result: Awaited<ReturnType<typeof transitionDeal>>;

  try {
    result = await transitionDeal({
      actorMemberId: member.id,
      organizationId: organization.id,

      dealId,

      expectedVersion: versionResult.data,

      targetStageId: stageId,
    });
  } catch (error) {
    console.error(
      "Failed to transition deal:",
      error instanceof Error ? error.message : "Unknown error",
    );

    redirect(`/crm/deals/${dealId}?error=stage-error`);
  }

  if (!result.success) {
    if (result.code === "conflict") {
      redirect(`/crm/deals/${dealId}?error=stage-conflict`);
    }

    if (
      result.code === "deal-not-found" ||
      result.code === "stage-not-found" ||
      result.code === "invalid-stage-type"
    ) {
      redirect("/crm/forbidden");
    }

    redirect("/crm/deals");
  }

  revalidatePath("/crm");

  revalidatePath("/crm/deals");

  revalidatePath(`/crm/deals/${result.dealId}`);

  redirectWithNotice(`/crm/deals/${result.dealId}`, "deal-stage");
}

export async function updateDeal(
  dealId: string,
  _previousState: UpdateDealState,
  formData: FormData,
): Promise<UpdateDealState> {
  const { organization, member, permissions } = await requireMutationPermission(
    "deals.update",
    formData,
  );

  if (!permissions.has("pipelines.read")) {
    redirect("/crm/forbidden");
  }

  const idResult = dealIdSchema.safeParse(dealId);

  if (!idResult.success) {
    redirect("/crm/deals");
  }

  const values = getFormValues(formData);

  /*
   * Версия Deal, которую
   * пользователь открыл
   * в форме редактирования.
   */
  const versionResult = dealVersionSchema.safeParse(formData.get("version"));

  if (!versionResult.success) {
    return {
      values,

      message: "Не удалось определить версию сделки. Обновите страницу.",
    };
  }

  const expectedVersion = versionResult.data;

  const result = updateDealSchema.safeParse(values);

  if (!result.success) {
    return {
      values,

      errors: result.error.flatten().fieldErrors,

      message: "Проверьте данные формы.",
    };
  }

  const data = result.data;

  /*
   * Здесь намеренно читаем Deal
   * независимо от archive-state.
   *
   * Благодаря этому можем отличить:
   *
   * - Deal не существует / чужой tenant
   * - Deal была архивирована после
   *   открытия формы
   */
  const [existingDeal] = await db
    .select({
      id: deals.id,

      version: deals.version,

      isArchived: deals.isArchived,

      pipelineId: deals.pipelineId,

      stageId: deals.stageId,

      companyId: deals.companyId,

      ownerMemberId: deals.ownerMemberId,

      closedAt: deals.closedAt,
    })
    .from(deals)
    .where(
      and(
        eq(deals.id, idResult.data),

        eq(deals.organizationId, organization.id),

        isNull(deals.deletedAt),
      ),
    )
    .limit(1);

  if (!existingDeal) {
    redirect("/crm/forbidden");
  }

  /*
   * Если Deal была архивирована
   * после открытия формы,
   * не считаем это forbidden.
   *
   * Это lifecycle conflict.
   */
  if (existingDeal.isArchived) {
    return {
      values,

      message:
        "Сделка была архивирована после открытия формы. Изменения не сохранены. Вернитесь к актуальной версии сделки.",
    };
  }

  /*
   * Первая проверка optimistic
   * locking.
   *
   * Если Deal была изменена
   * ещё до начала обработки
   * формы, прекращаем работу.
   */
  if (existingDeal.version !== expectedVersion) {
    return {
      values,

      message:
        "Сделка была изменена после открытия формы. Обновите страницу, проверьте актуальные данные и повторите изменения.",
    };
  }

  /*
   * Pipeline
   */

  const [pipeline] = await db
    .select({
      id: pipelines.id,
    })
    .from(pipelines)
    .where(
      and(
        eq(pipelines.id, data.pipelineId),

        eq(pipelines.organizationId, organization.id),

        eq(pipelines.isArchived, false),
      ),
    )
    .limit(1);

  if (!pipeline) {
    return {
      values,

      errors: {
        pipelineId: ["Выбранная воронка недоступна."],
      },

      message: "Проверьте данные формы.",
    };
  }

  /*
   * Stage обязательно должен
   * принадлежать выбранной Pipeline.
   */

  const [stage] = await db
    .select({
      id: pipelineStages.id,

      type: pipelineStages.type,
    })
    .from(pipelineStages)
    .where(
      and(
        eq(pipelineStages.id, data.stageId),

        eq(pipelineStages.organizationId, organization.id),

        eq(pipelineStages.pipelineId, pipeline.id),
      ),
    )
    .limit(1);

  if (!stage) {
    return {
      values,

      errors: {
        stageId: ["Этап не относится к выбранной воронке."],
      },

      message: "Проверьте данные формы.",
    };
  }

  /*
   * Company
   */

  if (data.companyId) {
    const companyChanged = data.companyId !== existingDeal.companyId;

    if (companyChanged && !permissions.has("companies.read")) {
      return {
        values,

        errors: {
          companyId: ["Нет доступа для изменения компании."],
        },

        message: "Проверьте данные формы.",
      };
    }

    const conditions = [
      eq(companies.id, data.companyId),

      eq(companies.organizationId, organization.id),

      isNull(companies.deletedAt),
    ];

    if (companyChanged) {
      conditions.push(eq(companies.isArchived, false));
    }

    const [company] = await db
      .select({
        id: companies.id,
      })
      .from(companies)
      .where(and(...conditions))
      .limit(1);

    if (!company) {
      return {
        values,

        errors: {
          companyId: ["Выбранная компания недоступна."],
        },

        message: "Проверьте данные формы.",
      };
    }
  }

  /*
   * Responsible Member.
   *
   * F05 + F08:
   * - unchanged owner may remain even if
   *   that Membership is now inactive;
   * - every newly assigned non-null owner
   *   must be active in this Organization;
   * - without members.read only self/null
   *   may be newly assigned.
   */
  const ownerResult = await resolveOwnerAssignment({
    organizationId: organization.id,

    mode: "update",

    currentMemberId: member.id,

    canReadMembers: permissions.has("members.read"),

    requestedOwnerMemberId: data.ownerMemberId,

    existingOwnerMemberId: existingDeal.ownerMemberId,
  });

  if (ownerResult.status === "forbidden") {
    return {
      values,

      errors: {
        ownerMemberId: ["Нельзя назначить этого сотрудника."],
      },

      message: "Проверьте данные формы.",
    };
  }

  if (ownerResult.status === "owner-unavailable") {
    return {
      values,

      errors: {
        ownerMemberId: ["Ответственный сотрудник недоступен."],
      },

      message: "Проверьте данные формы.",
    };
  }

  const expectedCloseAt = data.expectedCloseAt;

  const targetIsClosed = stage.type === "won" || stage.type === "lost";

  const closedAt = targetIsClosed
    ? (existingDeal.closedAt ?? new Date())
    : null;

  try {
    /*
     * Вторая и главная проверка
     * optimistic locking.
     *
     * Даже если другая операция
     * произошла после SELECT выше,
     * UPDATE разрешён только при
     * прежней version.
     *
     * isArchived=false здесь
     * обязательно оставляем.
     */
    const updated = await recordMutation(
      { organizationId: organization.id, memberId: member.id },
      () =>
        db
          .update(deals)
          .set({
            pipelineId: pipeline.id,

            stageId: stage.id,

            title: data.title,

            amount: data.amount,

            currency: data.currency,

            companyId: data.companyId,

            ownerMemberId: data.ownerMemberId,

            expectedCloseAt,

            closedAt,

            notes: data.notes,

            version: sql`${deals.version} + 1`,

            updatedAt: new Date(),
          })
          .where(
            and(
              eq(deals.id, existingDeal.id),

              eq(deals.organizationId, organization.id),

              eq(deals.version, expectedVersion),

              eq(deals.isArchived, false),

              isNull(deals.deletedAt),
            ),
          )
          .returning({
            id: deals.id,

            version: deals.version,
          }),
    );

    /*
     * 0 строк означает, что Deal
     * между SELECT и UPDATE уже
     * изменилась, была архивирована
     * или стала недоступна.
     */
    if (updated.length === 0) {
      return {
        values,

        message:
          "Сделка была изменена другим действием. Ваши изменения не сохранены. Обновите страницу и повторите попытку.",
      };
    }
  } catch (error) {
    console.error("Failed to update deal:", error);

    return {
      values,

      message: "Не удалось сохранить изменения.",
    };
  }

  revalidatePath("/crm");

  revalidatePath("/crm/deals");

  revalidatePath(`/crm/deals/${existingDeal.id}`);

  redirectWithNotice(`/crm/deals/${existingDeal.id}`, "deal-updated");
}

export async function archiveDeal(
  organizationScope: string,
  dealId: string,
  expectedVersion: number,
) {
  await changeLifecycle(organizationScope, dealId, expectedVersion, true);
}
export async function restoreDeal(
  organizationScope: string,
  dealId: string,
  expectedVersion: number,
) {
  await changeLifecycle(organizationScope, dealId, expectedVersion, false);
}
async function changeLifecycle(
  organizationScope: string,
  dealId: string,
  expectedVersion: number,
  archive: boolean,
) {
  const { organization, member } = await requireMutationPermission(
    "deals.archive",
    organizationScope,
  );
  if (!dealIdSchema.safeParse(dealId).success)
    redirect(archive ? "/crm/deals" : "/crm/deals/archive");
  const changed = await changeDealLifecycle({
    organizationId: organization.id,
    memberId: member.id,
    dealId,
    expectedVersion,
    archive,
  });
  if (!changed) redirect(`/crm/deals/${dealId}?error=lifecycle-conflict`);
  for (const path of [
    "/crm",
    "/crm/deals",
    "/crm/deals/archive",
    `/crm/deals/${dealId}`,
  ])
    revalidatePath(path);
  redirectWithNotice(
    archive
      ? `/crm/deals?pipeline=${changed.pipelineId}`
      : `/crm/deals/${changed.id}`,
    archive ? "deal-archived" : "deal-restored",
  );
}
