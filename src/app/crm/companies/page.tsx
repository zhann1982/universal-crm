import {
  and,
  count,
  desc,
  eq,
  ilike,
  isNull,
  or,
} from "drizzle-orm";
import Link from "next/link";
import {
  redirect,
} from "next/navigation";

import { db } from "@/db";
import {
  companies,
} from "@/db/schema";
import {
  requirePermission,
} from "@/lib/auth/permissions";
import {
  companyListQuerySchema,
  type CompanyListQuery,
} from "@/lib/validation/company";

type SearchParams = {
  [key: string]:
    | string
    | string[]
    | undefined;
};

const PAGE_SIZE = 25;

const statusLabels:
  Record<string, string> = {
    active:
      "Активная",

    prospect:
      "Потенциальная",

    inactive:
      "Неактивная",
  };

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams:
    Promise<SearchParams>;
}) {
  const rawSearchParams =
    await searchParams;

  const query =
    companyListQuerySchema.parse({
      q:
        rawSearchParams.q,

      status:
        rawSearchParams.status,

      view:
        rawSearchParams.view,

      page:
        rawSearchParams.page,
    });

  const {
    q,
    status,
    view,
    page,
  } = query;

  const {
    organization,
    permissions:
      currentPermissions,
  } = await requirePermission(
    "companies.read",
  );

  const searchCondition =
    q
      ? or(
          ilike(
            companies.name,
            `%${q}%`,
          ),

          ilike(
            companies.legalName,
            `%${q}%`,
          ),

          ilike(
            companies.taxId,
            `%${q}%`,
          ),

          ilike(
            companies.phone,
            `%${q}%`,
          ),

          ilike(
            companies.email,
            `%${q}%`,
          ),

          ilike(
            companies.industry,
            `%${q}%`,
          ),
        )
      : undefined;

  const statusCondition =
    status !== "all"
      ? eq(
          companies.status,
          status,
        )
      : undefined;

  const whereCondition =
    and(
      eq(
        companies.organizationId,
        organization.id,
      ),

      eq(
        companies.isArchived,
        view === "archive",
      ),

      isNull(
        companies.deletedAt,
      ),

      searchCondition,

      statusCondition,
    );

  const [countResult] =
    await db
      .select({
        total:
          count(),
      })
      .from(companies)
      .where(
        whereCondition,
      );

  const totalCompanies =
    countResult.total;

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        totalCompanies /
          PAGE_SIZE,
      ),
    );

  const currentPage =
    Math.min(
      page,
      totalPages,
    );

  if (
    page !== currentPage
  ) {
    redirect(
      buildCompaniesHref({
        q,
        status,
        view,
        page:
          currentPage,
      }),
    );
  }

  const offset =
    (currentPage - 1) *
    PAGE_SIZE;

  const companyList =
    await db
      .select()
      .from(companies)
      .where(
        whereCondition,
      )
      .orderBy(
        desc(
          companies.createdAt,
        ),
        desc(
          companies.id,
        ),
      )
      .limit(PAGE_SIZE)
      .offset(offset);

  const activeHref =
    buildCompaniesHref({
      q,
      status,
      view: "active",
      page: 1,
    });

  const archiveHref =
    buildCompaniesHref({
      q,
      status,
      view: "archive",
      page: 1,
    });

  const previousHref =
    currentPage > 1
      ? buildCompaniesHref({
          q,
          status,
          view,
          page:
            currentPage -
            1,
        })
      : null;

  const nextHref =
    currentPage <
    totalPages
      ? buildCompaniesHref({
          q,
          status,
          view,
          page:
            currentPage +
            1,
        })
      : null;

  const resetHref =
    view === "archive"
      ? "/crm/companies?view=archive"
      : "/crm/companies";

  const firstVisible =
    totalCompanies === 0
      ? 0
      : offset + 1;

  const lastVisible =
    Math.min(
      offset +
        companyList.length,
      totalCompanies,
    );

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">
            Компании
          </h1>

          <p className="mt-2 text-slate-500">
            {view ===
            "archive"
              ? "Архив компаний"
              : "Активные компании"}
            :{" "}
            {
              totalCompanies
            }
          </p>
        </div>

        {currentPermissions.has(
          "companies.create",
        ) && (
          <Link
            href="/crm/companies/new"
            className="rounded-lg bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            + Новая компания
          </Link>
        )}
      </div>

      <div className="mb-5 flex gap-2">
        <Link
          href={activeHref}
          className={
            view ===
            "active"
              ? "rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white"
              : "rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          }
        >
          Активные
        </Link>

        <Link
          href={
            archiveHref
          }
          className={
            view ===
            "archive"
              ? "rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white"
              : "rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          }
        >
          Архив
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <form
          action="/crm/companies"
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
              htmlFor="company-search"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Поиск
            </label>

            <input
              id="company-search"
              name="q"
              type="search"
              defaultValue={q}
              placeholder="Название, БИН, телефон, email..."
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-slate-500"
            />
          </div>

          <div className="w-full sm:w-52">
            <label
              htmlFor="company-status"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Статус
            </label>

            <select
              id="company-status"
              name="status"
              defaultValue={
                status
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-slate-500"
            >
              <option value="all">
                Все статусы
              </option>

              <option value="active">
                Активная
              </option>

              <option value="prospect">
                Потенциальная
              </option>

              <option value="inactive">
                Неактивная
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
            status !==
              "all") && (
            <Link
              href={
                resetHref
              }
              className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Сбросить
            </Link>
          )}
        </form>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-5 py-4 text-sm font-medium">
                  Компания
                </th>

                <th className="px-5 py-4 text-sm font-medium">
                  БИН / ID
                </th>

                <th className="px-5 py-4 text-sm font-medium">
                  Контакты
                </th>

                <th className="px-5 py-4 text-sm font-medium">
                  Отрасль
                </th>

                <th className="px-5 py-4 text-sm font-medium">
                  Статус
                </th>

                <th className="px-5 py-4 text-sm font-medium">
                  Создана
                </th>
              </tr>
            </thead>

            <tbody>
              {companyList.length ===
              0 ? (
                <tr>
                  <td
                    colSpan={
                      6
                    }
                    className="px-5 py-20 text-center"
                  >
                    <div className="font-medium">
                      Компании
                      не найдены
                    </div>

                    <div className="mt-2 text-sm text-slate-500">
                      {q ||
                      status !==
                        "all"
                        ? "Измените параметры поиска."
                        : view ===
                            "archive"
                          ? "Архив пока пуст."
                          : "Создайте первую компанию."}
                    </div>
                  </td>
                </tr>
              ) : (
                companyList.map(
                  (
                    company,
                  ) => (
                    <tr
                      key={
                        company.id
                      }
                      className="border-b border-slate-100 last:border-b-0"
                    >
                      <td className="px-5 py-4">
                        <div className="font-medium">
                          {
                            company.name
                          }
                        </div>

                        {company.legalName && (
                          <div className="mt-1 text-xs text-slate-500">
                            {
                              company.legalName
                            }
                          </div>
                        )}

                        {company.isArchived && (
                          <div className="mt-1">
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                              В архиве
                            </span>
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-4 text-slate-600">
                        {company.taxId ||
                          "—"}
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        <div>
                          {company.phone ||
                            "—"}
                        </div>

                        {company.email && (
                          <div className="mt-1 text-xs text-slate-500">
                            {
                              company.email
                            }
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-4 text-slate-600">
                        {company.industry ||
                          "—"}
                      </td>

                      <td className="px-5 py-4">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium">
                          {statusLabels[
                            company
                              .status
                          ] ??
                            company.status}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-500">
                        {company.createdAt.toLocaleDateString(
                          "ru-RU",
                        )}
                      </td>
                    </tr>
                  ),
                )
              )}
            </tbody>
          </table>
        </div>

        {totalCompanies >
          0 && (
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 px-5 py-4">
            <div className="text-sm text-slate-500">
              Показано{" "}
              <span className="font-medium text-slate-900">
                {
                  firstVisible
                }
              </span>
              {" — "}
              <span className="font-medium text-slate-900">
                {
                  lastVisible
                }
              </span>
              {" из "}
              <span className="font-medium text-slate-900">
                {
                  totalCompanies
                }
              </span>
            </div>

            <div className="flex items-center gap-3">
              {previousHref ? (
                <Link
                  href={
                    previousHref
                  }
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium transition hover:bg-slate-50"
                >
                  ← Назад
                </Link>
              ) : (
                <span className="cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-400">
                  ← Назад
                </span>
              )}

              <span className="text-sm text-slate-600">
                Страница{" "}
                <span className="font-medium text-slate-900">
                  {
                    currentPage
                  }
                </span>
                {" из "}
                <span className="font-medium text-slate-900">
                  {
                    totalPages
                  }
                </span>
              </span>

              {nextHref ? (
                <Link
                  href={
                    nextHref
                  }
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium transition hover:bg-slate-50"
                >
                  Вперёд →
                </Link>
              ) : (
                <span className="cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-400">
                  Вперёд →
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function buildCompaniesHref({
  q,
  status,
  view,
  page,
}: CompanyListQuery) {
  const params =
    new URLSearchParams();

  if (q) {
    params.set(
      "q",
      q,
    );
  }

  if (
    status !== "all"
  ) {
    params.set(
      "status",
      status,
    );
  }

  if (
    view !== "active"
  ) {
    params.set(
      "view",
      view,
    );
  }

  if (page > 1) {
    params.set(
      "page",
      String(page),
    );
  }

  const queryString =
    params.toString();

  return queryString
    ? `/crm/companies?${queryString}`
    : "/crm/companies";
}