import {
  and,
  asc,
  desc,
  eq,
  isNull,
} from "drizzle-orm";
import Link from "next/link";
import {
  redirect,
} from "next/navigation";
import { z } from "zod";

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

type SearchParams = {
  [key: string]:
    | string
    | string[]
    | undefined;
};

const pipelineIdSchema =
  z.string().uuid();

const stageTypeLabels:
  Record<string, string> = {
    open: "Открыта",
    won: "Выиграна",
    lost: "Проиграна",
  };

export default async function DealsPage({
  searchParams,
}: {
  searchParams:
    Promise<SearchParams>;
}) {
  const {
    organization,
    permissions,
  } = await requirePermission(
    "deals.read",
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

  const rawSearchParams =
    await searchParams;

  const pipelineList =
    await db
      .select({
        id:
          pipelines.id,

        name:
          pipelines.name,

        description:
          pipelines.description,

        isDefault:
          pipelines.isDefault,
      })
      .from(pipelines)
      .where(
        and(
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
      .orderBy(
        desc(
          pipelines.isDefault,
        ),
        asc(
          pipelines.name,
        ),
      );

  if (
    pipelineList.length === 0
  ) {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-3xl font-bold">
            Сделки
          </h1>

          <p className="mt-2 text-slate-500">
            Воронки продаж пока
            не настроены.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <div className="text-lg font-semibold">
            Нет доступных воронок
          </div>

          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
            Для работы со сделками
            нужна хотя бы одна
            активная воронка продаж.
          </p>
        </div>
      </div>
    );
  }

  const rawPipelineId =
    Array.isArray(
      rawSearchParams.pipeline,
    )
      ? rawSearchParams.pipeline[0]
      : rawSearchParams.pipeline;

  let selectedPipeline =
    pipelineList[0];

  if (rawPipelineId) {
    const pipelineIdResult =
      pipelineIdSchema.safeParse(
        rawPipelineId,
      );

    if (
      !pipelineIdResult.success
    ) {
      redirect(
        `/crm/deals?pipeline=${pipelineList[0].id}`,
      );
    }

    const requestedPipeline =
      pipelineList.find(
        (pipeline) =>
          pipeline.id ===
          pipelineIdResult.data,
      );

    if (!requestedPipeline) {
      redirect(
        `/crm/deals?pipeline=${pipelineList[0].id}`,
      );
    }

    selectedPipeline =
      requestedPipeline;
  }

  const stages =
    await db
      .select({
        id:
          pipelineStages.id,

        name:
          pipelineStages.name,

        type:
          pipelineStages.type,

        position:
          pipelineStages.position,

        probability:
          pipelineStages.probability,

        color:
          pipelineStages.color,
      })
      .from(
        pipelineStages,
      )
      .where(
        and(
          eq(
            pipelineStages.organizationId,
            organization.id,
          ),

          eq(
            pipelineStages.pipelineId,
            selectedPipeline.id,
          ),
        ),
      )
      .orderBy(
        asc(
          pipelineStages.position,
        ),
      );

  const dealList =
    await db
      .select({
        id:
          deals.id,

        title:
          deals.title,

        amount:
          deals.amount,

        currency:
          deals.currency,

        stageId:
          deals.stageId,

        expectedCloseAt:
          deals.expectedCloseAt,

        createdAt:
          deals.createdAt,

        companyId:
          deals.companyId,

        companyName:
          companies.name,

        ownerMemberId:
          deals.ownerMemberId,

        ownerDisplayName:
          organizationMembers.displayName,

        ownerEmail:
          organizationMembers.email,
      })
      .from(deals)
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
            deals.organizationId,
            organization.id,
          ),

          eq(
            deals.pipelineId,
            selectedPipeline.id,
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
      .orderBy(
        desc(
          deals.createdAt,
        ),
      );

  const dealMap =
    new Map<
      string,
      typeof dealList
    >();

  for (const stage of stages) {
    dealMap.set(
      stage.id,
      [],
    );
  }

  for (const deal of dealList) {
    const stageDeals =
      dealMap.get(
        deal.stageId,
      );

    if (stageDeals) {
      stageDeals.push(
        deal,
      );
    }
  }

  const totalAmount =
    dealList.reduce(
      (sum, deal) => {
        if (!deal.amount) {
          return sum;
        }

        const value =
          Number(
            deal.amount,
          );

        return Number.isFinite(
          value,
        )
          ? sum + value
          : sum;
      },
      0,
    );

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">
            Сделки
          </h1>

          <p className="mt-2 text-slate-500">
            Управление продажами
            по этапам воронки.
          </p>
        </div>

        {permissions.has(
          "deals.create",
        ) && (
          <Link
            href={`/crm/deals/new?pipeline=${selectedPipeline.id}`}
            className="rounded-lg bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            + Новая сделка
          </Link>
        )}
      </div>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <form
          action="/crm/deals"
          method="get"
          className="flex flex-wrap items-end gap-4"
        >
          <div className="min-w-64">
            <label
              htmlFor="pipeline"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Воронка
            </label>

            <select
              id="pipeline"
              name="pipeline"
              defaultValue={
                selectedPipeline.id
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-slate-500"
            >
              {pipelineList.map(
                (pipeline) => (
                  <option
                    key={
                      pipeline.id
                    }
                    value={
                      pipeline.id
                    }
                  >
                    {
                      pipeline.name
                    }
                    {pipeline.isDefault
                      ? " — основная"
                      : ""}
                  </option>
                ),
              )}
            </select>
          </div>

          <button
            type="submit"
            className="rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Открыть
          </button>
        </form>

        {selectedPipeline.description && (
          <p className="mt-4 text-sm text-slate-500">
            {
              selectedPipeline.description
            }
          </p>
        )}
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryCard
          label="Сделок"
          value={String(
            dealList.length,
          )}
        />

        <SummaryCard
          label="Общая сумма"
          value={
            totalAmount > 0
              ? formatAmount(
                  totalAmount,
                )
              : "—"
          }
        />

        <SummaryCard
          label="Этапов"
          value={String(
            stages.length,
          )}
        />
      </div>

      {stages.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <div className="font-semibold">
            В этой воронке нет
            этапов.
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto pb-6">
          <div className="flex min-w-max items-start gap-4">
            {stages.map(
              (stage) => {
                const stageDeals =
                  dealMap.get(
                    stage.id,
                  ) ?? [];

                const stageAmount =
                  stageDeals.reduce(
                    (
                      sum,
                      deal,
                    ) => {
                      if (
                        !deal.amount
                      ) {
                        return sum;
                      }

                      const value =
                        Number(
                          deal.amount,
                        );

                      return Number.isFinite(
                        value,
                      )
                        ? sum +
                            value
                        : sum;
                    },
                    0,
                  );

                return (
                  <section
                    key={
                      stage.id
                    }
                    className="w-80 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-sm"
                  >
                    <div className="border-b border-slate-200 bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h2 className="font-semibold">
                            {
                              stage.name
                            }
                          </h2>

                          <div className="mt-1 text-xs text-slate-500">
                            {stageTypeLabels[
                              stage.type
                            ] ??
                              stage.type}
                            {" · "}
                            {
                              stage.probability
                            }
                            %
                          </div>
                        </div>

                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium">
                          {
                            stageDeals.length
                          }
                        </span>
                      </div>

                      {stageAmount >
                        0 && (
                        <div className="mt-3 text-sm font-medium text-slate-700">
                          {formatAmount(
                            stageAmount,
                          )}
                        </div>
                      )}
                    </div>

                    <div className="space-y-3 p-3">
                      {stageDeals.length ===
                      0 ? (
                        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-400">
                          Сделок нет
                        </div>
                      ) : (
                        stageDeals.map(
                          (
                            deal,
                          ) => (
                            <article
                              key={
                                deal.id
                              }
                              className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
                            >
                              <div className="font-medium leading-5">
                                {
                                  deal.title
                                }
                              </div>

                              <div className="mt-3 text-lg font-semibold">
                                {deal.amount
                                  ? formatDealAmount(
                                      deal.amount,
                                      deal.currency,
                                    )
                                  : "Сумма не указана"}
                              </div>

                              {deal.companyName && (
                                <div className="mt-3">
                                  {deal.companyId ? (
                                    <Link
                                      href={`/crm/companies/${deal.companyId}`}
                                      className="text-sm text-slate-600 transition hover:text-blue-600 hover:underline"
                                    >
                                      {
                                        deal.companyName
                                      }
                                    </Link>
                                  ) : (
                                    <span className="text-sm text-slate-600">
                                      {
                                        deal.companyName
                                      }
                                    </span>
                                  )}
                                </div>
                              )}

                              <div className="mt-4 space-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500">
                                <div>
                                  Ответственный:{" "}
                                  <span className="text-slate-700">
                                    {deal.ownerDisplayName ||
                                      deal.ownerEmail ||
                                      "Не назначен"}
                                  </span>
                                </div>

                                <div>
                                  Закрытие:{" "}
                                  <span className="text-slate-700">
                                    {deal.expectedCloseAt
                                      ? deal.expectedCloseAt.toLocaleDateString(
                                          "ru-RU",
                                        )
                                      : "Не указано"}
                                  </span>
                                </div>
                              </div>
                            </article>
                          ),
                        )
                      )}
                    </div>
                  </section>
                );
              },
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-sm text-slate-500">
        {label}
      </div>

      <div className="mt-2 text-2xl font-bold">
        {value}
      </div>
    </div>
  );
}

function formatAmount(
  value: number,
) {
  return new Intl.NumberFormat(
    "ru-RU",
    {
      maximumFractionDigits: 2,
    },
  ).format(value);
}

function formatDealAmount(
  amount: string,
  currency:
    | string
    | null,
) {
  const value =
    Number(amount);

  if (
    !Number.isFinite(value)
  ) {
    return amount;
  }

  const formatted =
    new Intl.NumberFormat(
      "ru-RU",
      {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      },
    ).format(value);

  return currency
    ? `${formatted} ${currency}`
    : formatted;
}