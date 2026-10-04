import { and, asc, desc, eq, isNull, or, sql } from "drizzle-orm";
import Link from "@/components/app-link";
import { notFound, redirect } from "next/navigation";

import { db } from "@/db";
import {
  companies,
  organizationMembers,
  pipelineStages,
  pipelines,
} from "@/db/schema";
import { requirePermission } from "@/lib/auth/permissions";
import { getDealById } from "@/lib/deals/get-deal";
import { dealIdSchema } from "@/lib/validation/deal";

import { EditDealForm } from "./edit-deal-form";

export default async function EditDealPage({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  const { organization, member, permissions } =
    await requirePermission("deals.update");

  if (!permissions.has("pipelines.read")) {
    redirect("/crm/forbidden");
  }

  const { id } = await params;

  const idResult = dealIdSchema.safeParse(id);

  if (!idResult.success) {
    notFound();
  }

  const deal = await getDealById(idResult.data);

  if (!deal || deal.isArchived) {
    notFound();
  }

  /*
   * Pipelines.
   *
   * Текущая Pipeline остаётся
   * доступной даже если позже
   * была архивирована.
   */
  const pipelineList = await db
    .select({
      id: pipelines.id,

      name: pipelines.name,

      isDefault: pipelines.isDefault,
    })
    .from(pipelines)
    .where(
      and(
        eq(pipelines.organizationId, organization.id),

        or(
          eq(pipelines.isArchived, false),

          eq(pipelines.id, deal.pipelineId),
        ),
      ),
    )
    .orderBy(desc(pipelines.isDefault), asc(pipelines.name));

  const pipelineIds = pipelineList.map((pipeline) => pipeline.id);

  const stages =
    pipelineIds.length > 0
      ? await db
          .select({
            id: pipelineStages.id,

            pipelineId: pipelineStages.pipelineId,

            name: pipelineStages.name,

            type: pipelineStages.type,

            position: pipelineStages.position,
          })
          .from(pipelineStages)
          .where(eq(pipelineStages.organizationId, organization.id))
          .orderBy(asc(pipelineStages.position))
      : [];

  /*
   * Companies.
   *
   * С companies.read можно
   * выбирать доступные компании.
   *
   * Без companies.read показываем
   * только уже связанную Company,
   * чтобы существующую связь
   * можно было оставить без
   * изменения.
   */
  let companyList: Array<{
    id: string;

    name: string;

    taxId: string | null;
  }> = [];

  if (permissions.has("companies.read")) {
    companyList = await db
      .select({
        id: companies.id,

        name: companies.name,

        taxId: companies.taxId,
      })
      .from(companies)
      .where(
        and(
          eq(companies.organizationId, organization.id),

          isNull(companies.deletedAt),

          deal.companyId
            ? or(
                eq(companies.isArchived, false),

                eq(companies.id, deal.companyId),
              )
            : eq(companies.isArchived, false),
        ),
      )
      .orderBy(
        sql`CASE WHEN ${companies.id}=${deal.companyId}::uuid THEN 0 ELSE 1 END`,
        asc(companies.name),
      )
      .limit(50);
  } else if (deal.companyId) {
    companyList = [
      {
        id: deal.companyId,

        name: "Текущая компания",

        taxId: null,
      },
    ];
  }

  /*
   * F05 — owner picker.
   *
   * С members.read пользователь
   * получает активных сотрудников.
   *
   * Уже назначенный owner также
   * остаётся в списке, даже если
   * стал неактивным.
   *
   * Email сотрудников в Deal
   * owner-picker не передаётся.
   */
  let memberList: Array<{
    id: string;

    displayName: string | null;
  }> = [];

  if (permissions.has("members.read")) {
    memberList = await db
      .select({
        id: organizationMembers.id,

        displayName: organizationMembers.displayName,
      })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, organization.id),

          deal.ownerMemberId
            ? or(
                eq(organizationMembers.status, "active"),

                eq(organizationMembers.id, deal.ownerMemberId),
              )
            : eq(organizationMembers.status, "active"),
        ),
      )
      .orderBy(
        sql`CASE WHEN ${organizationMembers.id}=${deal.ownerMemberId}::uuid THEN 0 ELSE 1 END`,
        asc(organizationMembers.displayName),
      )
      .limit(50);
  } else {
    /*
     * Без members.read пользователь
     * может назначить себя.
     */
    memberList.push({
      id: member.id,

      displayName: member.displayName,
    });

    /*
     * Если текущий owner другой,
     * сохраняем существующий ID,
     * но скрываем имя сотрудника.
     *
     * Это позволяет сохранить
     * существующего owner, но
     * не раскрывает каталог Team.
     */
    if (deal.ownerMemberId && deal.ownerMemberId !== member.id) {
      memberList.push({
        id: deal.ownerMemberId,

        displayName: "Сотрудник",
      });
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8">
        <Link
          href={`/crm/deals/${deal.id}`}
          className="text-sm text-slate-500 transition hover:text-slate-900"
        >
          ← Назад к сделке
        </Link>

        <h1 className="mt-4 text-3xl font-bold">Редактирование сделки</h1>

        <p className="mt-2 text-slate-500">{deal.title}</p>
      </div>

      <EditDealForm
        dealId={deal.id}
        initialVersion={deal.version}
        pipelines={pipelineList}
        stages={stages}
        companies={companyList}
        members={memberList}
        initialValues={{
          title: deal.title,

          pipelineId: deal.pipelineId,

          stageId: deal.stageId,

          amount: deal.amount ?? "",

          currency: deal.currency ?? "",

          companyId: deal.companyId ?? "",

          ownerMemberId: deal.ownerMemberId ?? "",

          expectedCloseAt: deal.expectedCloseAt ?? "",

          notes: deal.notes ?? "",
        }}
      />
    </div>
  );
}
