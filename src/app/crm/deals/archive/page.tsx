import {
  and,
  desc,
  eq,
  isNull,
} from "drizzle-orm";
import Link from "next/link";
import {
  redirect,
} from "next/navigation";

import { db } from "@/db";
import {
  deals,
  pipelines,
  pipelineStages,
} from "@/db/schema";
import {
  requirePermission,
} from "@/lib/auth/permissions";

import {
  RestoreDealButton,
} from "../[id]/restore-deal-button";

export default async function ArchivedDealsPage() {
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

  const archivedDeals =
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

        updatedAt:
          deals.updatedAt,

        pipelineName:
          pipelines.name,

        stageName:
          pipelineStages.name,
      })
      .from(deals)
      .innerJoin(
        pipelines,
        and(
          eq(
            deals.pipelineId,
            pipelines.id,
          ),

          eq(
            pipelines.organizationId,
            organization.id,
          ),
        ),
      )
      .innerJoin(
        pipelineStages,
        and(
          eq(
            deals.stageId,
            pipelineStages.id,
          ),

          eq(
            pipelineStages.organizationId,
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
            deals.isArchived,
            true,
          ),

          isNull(
            deals.deletedAt,
          ),
        ),
      )
      .orderBy(
        desc(
          deals.updatedAt,
        ),
      );

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8">
        <Link
          href="/crm/deals"
          className="text-sm text-slate-500 transition hover:text-slate-900"
        >
          ← Назад к сделкам
        </Link>

        <div className="mt-4">
          <h1 className="text-3xl font-bold">
            Архив сделок
          </h1>

          <p className="mt-2 text-slate-500">
            Архивные сделки не
            отображаются на
            Kanban-доске.
          </p>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-sm text-slate-500">
          В архиве
        </div>

        <div className="mt-1 text-2xl font-bold">
          {
            archivedDeals.length
          }
        </div>
      </div>

      {archivedDeals.length ===
      0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <h2 className="font-semibold">
            Архив пуст
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Архивированные сделки
            появятся здесь.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-3xl text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-4">
                    Сделка
                  </th>

                  <th className="px-5 py-4">
                    Воронка
                  </th>

                  <th className="px-5 py-4">
                    Этап
                  </th>

                  <th className="px-5 py-4">
                    Сумма
                  </th>

                  <th className="px-5 py-4">
                    Обновлена
                  </th>

                  <th className="px-5 py-4 text-right">
                    Действия
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {archivedDeals.map(
                  (deal) => (
                    <tr
                      key={
                        deal.id
                      }
                      className="transition hover:bg-slate-50"
                    >
                      <td className="px-5 py-4">
                        <Link
                          href={`/crm/deals/${deal.id}`}
                          className="font-medium transition hover:text-blue-600 hover:underline"
                        >
                          {
                            deal.title
                          }
                        </Link>
                      </td>

                      <td className="px-5 py-4 text-slate-600">
                        {
                          deal.pipelineName
                        }
                      </td>

                      <td className="px-5 py-4 text-slate-600">
                        {
                          deal.stageName
                        }
                      </td>

                      <td className="px-5 py-4 font-medium">
                        {deal.amount
                          ? formatDealAmount(
                              deal.amount,
                              deal.currency,
                            )
                          : "—"}
                      </td>

                      <td className="px-5 py-4 text-slate-500">
                        {deal.updatedAt.toLocaleString(
                          "ru-RU",
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <Link
                            href={`/crm/deals/${deal.id}`}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium transition hover:bg-slate-50"
                          >
                            Открыть
                          </Link>

                          {permissions.has(
                            "deals.archive",
                          ) && (
                            <RestoreDealButton
                              dealId={
                                deal.id
                              }
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
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
    !Number.isFinite(
      value,
    )
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