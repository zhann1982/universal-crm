"use client";

import Link from "next/link";
import {
  useRouter,
} from "next/navigation";
import {
  useState,
  useTransition,
} from "react";

import {
  formatMoney,
  formatNumber,
  groupMoneyByCurrency,
} from "@/lib/money";

import {
  moveDealOnBoard,
} from "./board-actions";

type StageItem = {
  id: string;
  name: string;
  type: string;
  position: number;
  probability: number;

  color:
    | string
    | null;
};

type DealItem = {
  id: string;
  title: string;

  amount:
    | string
    | null;

  currency:
    | string
    | null;

  stageId: string;

  expectedCloseAt:
    | string
    | null;

  companyId:
    | string
    | null;

  companyName:
    | string
    | null;

  ownerDisplayName:
    | string
    | null;

  ownerEmail:
    | string
    | null;
};

const stageTypeLabels:
  Record<string, string> = {
    open: "Открыта",
    won: "Выиграна",
    lost: "Проиграна",
  };

export function KanbanBoard({
  stages,
  deals,
  canUpdate,
}: {
  stages:
    StageItem[];

  deals:
    DealItem[];

  canUpdate:
    boolean;
}) {
  const router =
    useRouter();

  const [
    pending,
    startTransition,
  ] = useTransition();

  const [
    draggingDealId,
    setDraggingDealId,
  ] = useState<
    string | null
  >(null);

  const [
    overStageId,
    setOverStageId,
  ] = useState<
    string | null
  >(null);

  const [
    error,
    setError,
  ] = useState<
    string | null
  >(null);

  function clearDragState() {
    setDraggingDealId(
      null,
    );

    setOverStageId(
      null,
    );
  }

  function handleDrop(
    targetStageId: string,
  ) {
    if (
      !canUpdate ||
      !draggingDealId ||
      pending
    ) {
      clearDragState();
      return;
    }

    const deal =
      deals.find(
        (item) =>
          item.id ===
          draggingDealId,
      );

    if (!deal) {
      clearDragState();
      return;
    }

    if (
      deal.stageId ===
      targetStageId
    ) {
      clearDragState();
      return;
    }

    const dealId =
      deal.id;

    clearDragState();

    setError(
      null,
    );

    startTransition(
      async () => {
        const result =
          await moveDealOnBoard(
            dealId,
            targetStageId,
          );

        if (
          !result.success
        ) {
          setError(
            result.message,
          );

          return;
        }

        router.refresh();
      },
    );
  }

  return (
    <div>
      {canUpdate && (
        <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          Карточки можно
          перетаскивать между
          этапами воронки.
        </div>
      )}

      {pending && (
        <div className="mb-4 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
          Сохраняем новый
          этап сделки...
        </div>
      )}

      {error && (
        <div className="mb-4 flex items-start justify-between gap-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>
            {error}
          </span>

          <button
            type="button"
            onClick={() =>
              setError(
                null,
              )
            }
            className="font-medium hover:underline"
          >
            Закрыть
          </button>
        </div>
      )}

      <div className="overflow-x-auto pb-6">
        <div className="flex min-w-max items-start gap-4">
          {stages.map(
            (stage) => {
              const stageDeals =
                deals.filter(
                  (deal) =>
                    deal.stageId ===
                    stage.id,
                );

              const stageTotals =
                groupMoneyByCurrency(
                  stageDeals,
                );

              const isOver =
                overStageId ===
                stage.id;

              return (
                <section
                  key={
                    stage.id
                  }
                  onDragOver={(
                    event,
                  ) => {
                    if (
                      !canUpdate ||
                      pending
                    ) {
                      return;
                    }

                    event.preventDefault();

                    event.dataTransfer.dropEffect =
                      "move";

                    setOverStageId(
                      stage.id,
                    );
                  }}
                  onDragEnter={(
                    event,
                  ) => {
                    if (
                      !canUpdate ||
                      pending
                    ) {
                      return;
                    }

                    event.preventDefault();

                    setOverStageId(
                      stage.id,
                    );
                  }}
                  onDragLeave={(
                    event,
                  ) => {
                    const related =
                      event.relatedTarget;

                    if (
                      related instanceof
                        Node &&
                      event.currentTarget.contains(
                        related,
                      )
                    ) {
                      return;
                    }

                    if (
                      overStageId ===
                      stage.id
                    ) {
                      setOverStageId(
                        null,
                      );
                    }
                  }}
                  onDrop={(
                    event,
                  ) => {
                    event.preventDefault();

                    handleDrop(
                      stage.id,
                    );
                  }}
                  className={[
                    "w-80 shrink-0 overflow-hidden rounded-xl border bg-slate-50 shadow-sm transition",
                    isOver
                      ? "border-blue-400 ring-2 ring-blue-100"
                      : "border-slate-200",
                  ].join(
                    " ",
                  )}
                >
                  <div
                    className={[
                      "border-b p-4 transition",
                      isOver
                        ? "border-blue-200 bg-blue-50"
                        : "border-slate-200 bg-white",
                    ].join(
                      " ",
                    )}
                  >
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

                    {stageTotals.length >
                      0 && (
                      <div className="mt-3 space-y-1 border-t border-slate-100 pt-3">
                        {stageTotals.map(
                          (
                            total,
                          ) => (
                            <div
                              key={
                                total.currency
                              }
                              className="flex items-center justify-between gap-3 text-sm"
                            >
                              <span className="font-medium text-slate-700">
                                {formatNumber(
                                  total.amount,
                                )}
                              </span>

                              <span className="text-xs font-semibold text-slate-500">
                                {
                                  total.currency
                                }
                              </span>
                            </div>
                          ),
                        )}
                      </div>
                    )}

                    {isOver &&
                      draggingDealId && (
                        <div className="mt-3 rounded-lg border border-dashed border-blue-300 bg-white px-3 py-2 text-center text-xs font-medium text-blue-700">
                          Отпустите
                          карточку здесь
                        </div>
                      )}
                  </div>

                  <div className="min-h-32 space-y-3 p-3">
                    {stageDeals.length ===
                    0 ? (
                      <div
                        className={[
                          "rounded-lg border border-dashed p-6 text-center text-sm transition",
                          isOver
                            ? "border-blue-300 bg-blue-50 text-blue-600"
                            : "border-slate-300 bg-white text-slate-400",
                        ].join(
                          " ",
                        )}
                      >
                        {isOver
                          ? "Переместить сюда"
                          : "Сделок нет"}
                      </div>
                    ) : (
                      stageDeals.map(
                        (
                          deal,
                        ) => {
                          const isDragging =
                            draggingDealId ===
                            deal.id;

                          return (
                            <article
                              key={
                                deal.id
                              }
                              draggable={
                                canUpdate &&
                                !pending
                              }
                              onDragStart={(
                                event,
                              ) => {
                                if (
                                  !canUpdate ||
                                  pending
                                ) {
                                  event.preventDefault();
                                  return;
                                }

                                event.dataTransfer.effectAllowed =
                                  "move";

                                event.dataTransfer.setData(
                                  "text/plain",
                                  deal.id,
                                );

                                setDraggingDealId(
                                  deal.id,
                                );

                                setError(
                                  null,
                                );
                              }}
                              onDragEnd={() => {
                                clearDragState();
                              }}
                              className={[
                                "rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition",
                                canUpdate
                                  ? "cursor-grab active:cursor-grabbing"
                                  : "",
                                isDragging
                                  ? "opacity-40"
                                  : "hover:border-slate-300 hover:shadow-md",
                              ].join(
                                " ",
                              )}
                            >
                              {canUpdate && (
                                <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2">
                                  <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                                    ⋮⋮
                                    Перетащить
                                  </span>
                                </div>
                              )}

                              <div className="font-medium leading-5">
                                <Link
                                  href={`/crm/deals/${deal.id}`}
                                  draggable={
                                    false
                                  }
                                  className="transition hover:text-blue-600 hover:underline"
                                >
                                  {
                                    deal.title
                                  }
                                </Link>
                              </div>

                              <div className="mt-3 text-lg font-semibold">
                                {deal.amount
                                  ? formatMoney(
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
                                      draggable={
                                        false
                                      }
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
                                      ? new Date(
                                          deal.expectedCloseAt,
                                        ).toLocaleDateString(
                                          "ru-RU",
                                        )
                                      : "Не указано"}
                                  </span>
                                </div>
                              </div>
                            </article>
                          );
                        },
                      )
                    )}
                  </div>
                </section>
              );
            },
          )}
        </div>
      </div>
    </div>
  );
}