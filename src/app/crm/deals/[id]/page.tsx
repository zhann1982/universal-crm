import {
  and,
  asc,
  eq,
} from "drizzle-orm";
import Link from "next/link";
import {
  notFound,
} from "next/navigation";

import { db } from "@/db";
import {
  pipelineStages,
} from "@/db/schema";
import {
  requirePermission,
} from "@/lib/auth/permissions";
import {
  getDealById,
} from "@/lib/deals/get-deal";
import {
  dealIdSchema,
} from "@/lib/validation/deal";

import {
  moveDealToStage,
} from "../actions";

const stageTypeLabels:
  Record<string, string> = {
    open: "Открытая",
    won: "Выиграна",
    lost: "Проиграна",
  };

export default async function DealPage({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  const {
    organization,
    permissions,
  } = await requirePermission(
    "deals.read",
  );

  const { id } =
    await params;

  const idResult =
    dealIdSchema.safeParse(
      id,
    );

  if (!idResult.success) {
    notFound();
  }

  const deal =
    await getDealById(
      idResult.data,
    );

  if (!deal) {
    notFound();
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

        probability:
          pipelineStages.probability,

        position:
          pipelineStages.position,
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
            deal.pipelineId,
          ),
        ),
      )
      .orderBy(
        asc(
          pipelineStages.position,
        ),
      );

  const moveAction =
    moveDealToStage.bind(
      null,
      deal.id,
    );

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8">
        <Link
          href={`/crm/deals?pipeline=${deal.pipelineId}`}
          className="text-sm text-slate-500 transition hover:text-slate-900"
        >
          ← Назад к воронке
        </Link>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold">
                {deal.title}
              </h1>

              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium">
                {
                  deal.stageName
                }
              </span>

              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                {stageTypeLabels[
                  deal.stageType
                ] ??
                  deal.stageType}
              </span>
            </div>

            <p className="mt-2 text-sm text-slate-500">
              Воронка:{" "}
              {
                deal.pipelineName
              }
            </p>
          </div>
        </div>
      </div>

      {permissions.has(
        "deals.update",
      ) &&
        !deal.isArchived && (
          <section className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">
              Этап сделки
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Переместите сделку
              на другой этап
              текущей воронки.
            </p>

            <form
              action={
                moveAction
              }
              className="mt-5 flex flex-wrap items-end gap-3"
            >
              <div className="min-w-64 flex-1">
                <label
                  htmlFor="stageId"
                  className="mb-2 block text-sm font-medium"
                >
                  Этап
                </label>

                <select
                  id="stageId"
                  name="stageId"
                  defaultValue={
                    deal.stageId
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-slate-500"
                >
                  {stages.map(
                    (
                      stage,
                    ) => (
                      <option
                        key={
                          stage.id
                        }
                        value={
                          stage.id
                        }
                      >
                        {
                          stage.name
                        }
                        {" — "}
                        {
                          stage.probability
                        }
                        %
                      </option>
                    ),
                  )}
                </select>
              </div>

              <button
                type="submit"
                className="rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                Переместить
              </button>
            </form>
          </section>
        )}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
          <h2 className="text-lg font-semibold">
            Сделка
          </h2>

          <dl className="mt-6 grid gap-6 sm:grid-cols-2">
            <InfoItem
              label="Сумма"
              value={
                deal.amount
                  ? formatDealAmount(
                      deal.amount,
                      deal.currency,
                    )
                  : null
              }
            />

            <InfoItem
              label="Вероятность"
              value={`${deal.stageProbability}%`}
            />

            <InfoItem
              label="Воронка"
              value={
                deal.pipelineName
              }
            />

            <InfoItem
              label="Этап"
              value={
                deal.stageName
              }
            />

            <InfoItem
              label="Ожидаемое закрытие"
              value={
                deal.expectedCloseAt
                  ? deal.expectedCloseAt.toLocaleDateString(
                      "ru-RU",
                    )
                  : null
              }
            />

            <InfoItem
              label="Фактическое закрытие"
              value={
                deal.closedAt
                  ? deal.closedAt.toLocaleString(
                      "ru-RU",
                    )
                  : null
              }
            />
          </dl>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">
            CRM
          </h2>

          <dl className="mt-6 space-y-5">
            <InfoItem
              label="Ответственный"
              value={
                deal.ownerDisplayName ||
                deal.ownerEmail
              }
            />

            <InfoItem
              label="Создана"
              value={deal.createdAt.toLocaleString(
                "ru-RU",
              )}
            />

            <InfoItem
              label="Обновлена"
              value={deal.updatedAt.toLocaleString(
                "ru-RU",
              )}
            />
          </dl>
        </section>
      </div>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">
          Компания
        </h2>

        {deal.companyId &&
        deal.companyName ? (
          <div className="mt-4">
            <Link
              href={`/crm/companies/${deal.companyId}`}
              className="font-medium transition hover:text-blue-600 hover:underline"
            >
              {
                deal.companyName
              }
            </Link>
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-400">
            Компания не
            указана.
          </p>
        )}
      </section>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">
          Заметки
        </h2>

        {deal.notes ? (
          <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">
            {deal.notes}
          </p>
        ) : (
          <p className="mt-4 text-sm text-slate-400">
            Заметок пока нет.
          </p>
        )}
      </section>
    </div>
  );
}

function InfoItem({
  label,
  value,
}: {
  label: string;

  value:
    | string
    | null
    | undefined;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </dt>

      <dd className="mt-1.5 break-words text-sm text-slate-800">
        {value || "—"}
      </dd>
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