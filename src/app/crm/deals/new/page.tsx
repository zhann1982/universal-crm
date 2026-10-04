import { and, asc, sql, desc, eq, isNull } from "drizzle-orm";
import Link from "@/components/app-link";
import { redirect } from "next/navigation";

import { db } from "@/db";
import {
  companies,
  organizationMembers,
  pipelineStages,
  pipelines,
} from "@/db/schema";
import { requirePermission } from "@/lib/auth/permissions";

import { DealForm } from "./deal-form";

type SearchParams = {
  [key: string]: string | string[] | undefined;
};

export default async function NewDealPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { organization, member, permissions } =
    await requirePermission("deals.create");

  if (!permissions.has("pipelines.read")) {
    redirect("/crm/forbidden");
  }

  const rawSearchParams = await searchParams;

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

        eq(pipelines.isArchived, false),
      ),
    )
    .orderBy(desc(pipelines.isDefault), asc(pipelines.name));

  if (pipelineList.length === 0) {
    redirect("/crm/deals");
  }

  const stages = await db
    .select({
      id: pipelineStages.id,

      pipelineId: pipelineStages.pipelineId,

      name: pipelineStages.name,

      type: pipelineStages.type,

      position: pipelineStages.position,
    })
    .from(pipelineStages)
    .where(eq(pipelineStages.organizationId, organization.id))
    .orderBy(asc(pipelineStages.position));

  const rawPipeline = Array.isArray(rawSearchParams.pipeline)
    ? rawSearchParams.pipeline[0]
    : rawSearchParams.pipeline;

  const requestedPipeline = rawPipeline
    ? pipelineList.find((pipeline) => pipeline.id === rawPipeline)
    : undefined;

  const defaultPipeline = requestedPipeline ?? pipelineList[0];

  const defaultStage = stages.find(
    (stage) => stage.pipelineId === defaultPipeline.id,
  );

  /*
   * Company reference data.
   *
   * Пользователь получает список
   * компаний только при наличии
   * companies.read.
   */
  const companyList = permissions.has("companies.read")
    ? await db
        .select({
          id: companies.id,

          name: companies.name,

          taxId: companies.taxId,
        })
        .from(companies)
        .where(
          and(
            eq(companies.organizationId, organization.id),

            eq(companies.isArchived, false),

            isNull(companies.deletedAt),
          ),
        )
        .orderBy(asc(companies.name))
        .limit(50)
    : [];

  /*
   * F05.
   *
   * С members.read пользователь
   * получает каталог активных
   * сотрудников.
   *
   * Без members.read доступен
   * только текущий пользователь.
   *
   * Email для owner-picker
   * не загружается.
   */
  let memberList: Array<{
    id: string;

    displayName: string | null;
  }>;

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

          eq(organizationMembers.status, "active"),
        ),
      )
      .orderBy(
        sql`CASE WHEN ${organizationMembers.id}=${member.id}::uuid THEN 0 ELSE 1 END`,
        asc(organizationMembers.displayName),
      )
      .limit(50);
  } else {
    memberList = [
      {
        id: member.id,

        displayName: member.displayName,
      },
    ];
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8">
        <Link
          href={`/crm/deals?pipeline=${defaultPipeline.id}`}
          className="text-sm text-slate-500 transition hover:text-slate-900"
        >
          ← Назад к сделкам
        </Link>

        <h1 className="mt-4 text-3xl font-bold">Новая сделка</h1>

        <p className="mt-2 text-slate-500">
          Создайте сделку и поместите её в нужный этап воронки.
        </p>
      </div>

      <DealForm
        pipelines={pipelineList}
        stages={stages}
        companies={companyList}
        members={memberList}
        defaultPipelineId={defaultPipeline.id}
        defaultStageId={defaultStage?.id ?? ""}
        defaultOwnerMemberId={member.id}
      />
    </div>
  );
}
