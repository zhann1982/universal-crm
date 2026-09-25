import {
  and,
  desc,
  eq,
  ilike,
  isNull,
  or,
} from "drizzle-orm";
import Link from "next/link";

import { db } from "@/db";
import { clients } from "@/db/schema";
import { getCurrentOrganization } from "@/lib/current-organization";
import {
  clientListQuerySchema,
  type ClientListQuery,
} from "@/lib/validation/client";

type SearchParams = {
  [key: string]:
    | string
    | string[]
    | undefined;
};

const statusLabels: Record<
  string,
  string
> = {
  active: "Активный",
  lead: "Лид",
  inactive: "Неактивный",
};

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const rawSearchParams =
    await searchParams;

  const query =
    clientListQuerySchema.parse({
      q: rawSearchParams.q,
      status: rawSearchParams.status,
      view: rawSearchParams.view,
    });

  const {
    q,
    status,
    view,
  } = query;

  const organization =
    await getCurrentOrganization();

  const searchCondition = q
    ? or(
        ilike(
          clients.firstName,
          `%${q}%`,
        ),
        ilike(
          clients.lastName,
          `%${q}%`,
        ),
        ilike(
          clients.middleName,
          `%${q}%`,
        ),
        ilike(
          clients.phone,
          `%${q}%`,
        ),
        ilike(
          clients.email,
          `%${q}%`,
        ),
      )
    : undefined;

  const statusCondition =
    status !== "all"
      ? eq(
          clients.status,
          status,
        )
      : undefined;

  const clientList = await db
    .select()
    .from(clients)
    .where(
      and(
        eq(
          clients.organizationId,
          organization.id,
        ),

        eq(
          clients.isArchived,
          view === "archive",
        ),

        isNull(
          clients.deletedAt,
        ),

        searchCondition,

        statusCondition,
      ),
    )
    .orderBy(
      desc(clients.createdAt),
    );

  const activeHref =
    buildClientsHref({
      q,
      status,
      view: "active",
    });

  const archiveHref =
    buildClientsHref({
      q,
      status,
      view: "archive",
    });

  const resetHref =
    view === "archive"
      ? "/crm/clients?view=archive"
      : "/crm/clients";

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">
            Клиенты
          </h1>

          <p className="mt-2 text-slate-500">
            {view === "archive"
              ? "Архив клиентов"
              : "Активные клиенты"}
            : {clientList.length}
          </p>
        </div>

        <Link
          href="/crm/clients/new"
          className="rounded-lg bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          + Новый клиент
        </Link>
      </div>

      <div className="mb-5 flex gap-2">
        <Link
          href={activeHref}
          className={
            view === "active"
              ? "rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white"
              : "rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          }
        >
          Активные
        </Link>

        <Link
          href={archiveHref}
          className={
            view === "archive"
              ? "rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white"
              : "rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          }
        >
          Архив
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <form
          action="/crm/clients"
          method="get"
          className="flex flex-wrap items-end gap-4 border-b border-slate-200 p-4"
        >
          <input
            type="hidden"
            name="view"
            value={view}
          />

          <div className="min-w-64 flex-1">
            <label
              htmlFor="client-search"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Поиск
            </label>

            <input
              id="client-search"
              name="q"
              type="search"
              defaultValue={q}
              placeholder="Имя, телефон или email..."
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-slate-500"
            />
          </div>

          <div className="w-full sm:w-52">
            <label
              htmlFor="client-status"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Статус
            </label>

            <select
              id="client-status"
              name="status"
              defaultValue={status}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-slate-500"
            >
              <option value="all">
                Все статусы
              </option>

              <option value="active">
                Активный
              </option>

              <option value="lead">
                Лид
              </option>

              <option value="inactive">
                Неактивный
              </option>
            </select>
          </div>

          <button
            type="submit"
            className="rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Найти
          </button>

          {(q ||
            status !== "all") && (
            <Link
              href={resetHref}
              className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Сбросить
            </Link>
          )}
        </form>

        {(q ||
          status !== "all") && (
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-3 text-sm text-slate-600">
            Найдено записей:{" "}
            <span className="font-medium text-slate-900">
              {clientList.length}
            </span>

            {q && (
              <>
                {" "}
                по запросу{" "}
                <span className="font-medium text-slate-900">
                  «{q}»
                </span>
              </>
            )}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-5 py-4 text-sm font-medium">
                  Клиент
                </th>

                <th className="px-5 py-4 text-sm font-medium">
                  Телефон
                </th>

                <th className="px-5 py-4 text-sm font-medium">
                  Email
                </th>

                <th className="px-5 py-4 text-sm font-medium">
                  Статус
                </th>

                <th className="px-5 py-4 text-sm font-medium">
                  Источник
                </th>

                <th className="px-5 py-4 text-sm font-medium">
                  Создан
                </th>
              </tr>
            </thead>

            <tbody>
              {clientList.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-20 text-center"
                  >
                    <div className="font-medium">
                      {getEmptyTitle({
                        q,
                        status,
                        view,
                      })}
                    </div>

                    <div className="mt-2 text-sm text-slate-500">
                      {getEmptyDescription({
                        q,
                        status,
                        view,
                      })}
                    </div>
                  </td>
                </tr>
              ) : (
                clientList.map(
                  (client) => {
                    const fullName = [
                      client.lastName,
                      client.firstName,
                      client.middleName,
                    ]
                      .filter(Boolean)
                      .join(" ");

                    return (
                      <tr
                        key={client.id}
                        className="border-b border-slate-100 last:border-b-0"
                      >
                        <td className="px-5 py-4 font-medium">
                          <Link
                            href={`/crm/clients/${client.id}`}
                            className="transition hover:text-blue-600 hover:underline"
                          >
                            {fullName ||
                              "Без имени"}
                          </Link>

                          {client.isArchived && (
                            <div className="mt-1">
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                                В архиве
                              </span>
                            </div>
                          )}
                        </td>

                        <td className="px-5 py-4 text-slate-600">
                          {client.phone ||
                            "—"}
                        </td>

                        <td className="px-5 py-4 text-slate-600">
                          {client.email ||
                            "—"}
                        </td>

                        <td className="px-5 py-4">
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium">
                            {statusLabels[
                              client.status
                            ] ??
                              client.status}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-slate-600">
                          {client.source ||
                            "—"}
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-500">
                          {client.createdAt.toLocaleDateString(
                            "ru-RU",
                          )}
                        </td>
                      </tr>
                    );
                  },
                )
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function buildClientsHref({
  q,
  status,
  view,
}: ClientListQuery) {
  const params =
    new URLSearchParams();

  if (q) {
    params.set("q", q);
  }

  if (status !== "all") {
    params.set(
      "status",
      status,
    );
  }

  if (view !== "active") {
    params.set(
      "view",
      view,
    );
  }

  const queryString =
    params.toString();

  return queryString
    ? `/crm/clients?${queryString}`
    : "/crm/clients";
}

function getEmptyTitle({
  q,
  status,
  view,
}: ClientListQuery) {
  if (
    q ||
    status !== "all"
  ) {
    return "Клиенты не найдены";
  }

  if (view === "archive") {
    return "Архив пуст";
  }

  return "Клиентов пока нет";
}

function getEmptyDescription({
  q,
  status,
  view,
}: ClientListQuery) {
  if (
    q ||
    status !== "all"
  ) {
    return "Попробуйте изменить поисковый запрос или фильтр.";
  }

  if (view === "archive") {
    return "Архивированные клиенты появятся здесь.";
  }

  return "Создайте первого клиента.";
}