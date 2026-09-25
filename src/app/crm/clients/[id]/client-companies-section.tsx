import {
  and,
  asc,
  eq,
  isNull,
} from "drizzle-orm";
import Link from "next/link";

import { db } from "@/db";
import {
  clientCompanies,
  companies,
} from "@/db/schema";

import {
  linkClientToCompany,
  unlinkClientFromCompany,
} from "../../client-company-actions";

export async function ClientCompaniesSection({
  organizationId,
  clientId,
  clientIsArchived,
  canReadCompanies,
  canManageRelations,
}: {
  organizationId: string;
  clientId: string;
  clientIsArchived: boolean;
  canReadCompanies: boolean;
  canManageRelations: boolean;
}) {
  if (!canReadCompanies) {
    return null;
  }

  const linkedCompanies =
    await db
      .select({
        id:
          companies.id,

        name:
          companies.name,

        legalName:
          companies.legalName,

        taxId:
          companies.taxId,

        status:
          companies.status,

        isArchived:
          companies.isArchived,
      })
      .from(
        clientCompanies,
      )
      .innerJoin(
        companies,
        eq(
          clientCompanies.companyId,
          companies.id,
        ),
      )
      .where(
        and(
          eq(
            clientCompanies.organizationId,
            organizationId,
          ),

          eq(
            clientCompanies.clientId,
            clientId,
          ),

          eq(
            companies.organizationId,
            organizationId,
          ),

          isNull(
            companies.deletedAt,
          ),
        ),
      )
      .orderBy(
        asc(
          companies.name,
        ),
      );

  const linkedIds =
    new Set(
      linkedCompanies.map(
        (company) =>
          company.id,
      ),
    );

  const activeCompanies =
    await db
      .select({
        id:
          companies.id,

        name:
          companies.name,

        taxId:
          companies.taxId,
      })
      .from(companies)
      .where(
        and(
          eq(
            companies.organizationId,
            organizationId,
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
      .orderBy(
        asc(
          companies.name,
        ),
      );

  const availableCompanies =
    activeCompanies.filter(
      (company) =>
        !linkedIds.has(
          company.id,
        ),
    );

  return (
    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">
            Компании
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Связано компаний:{" "}
            {
              linkedCompanies.length
            }
          </p>
        </div>
      </div>

      {linkedCompanies.length ===
      0 ? (
        <p className="mt-6 text-sm text-slate-400">
          Клиент пока не связан
          ни с одной компанией.
        </p>
      ) : (
        <div className="mt-6 divide-y divide-slate-100 rounded-lg border border-slate-200">
          {linkedCompanies.map(
            (company) => (
              <div
                key={
                  company.id
                }
                className="flex flex-wrap items-center justify-between gap-4 p-4"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/crm/companies/${company.id}`}
                      className="font-medium transition hover:text-blue-600 hover:underline"
                    >
                      {
                        company.name
                      }
                    </Link>

                    {company.isArchived && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                        В архиве
                      </span>
                    )}
                  </div>

                  {company.legalName && (
                    <div className="mt-1 text-sm text-slate-500">
                      {
                        company.legalName
                      }
                    </div>
                  )}

                  {company.taxId && (
                    <div className="mt-1 text-xs text-slate-400">
                      БИН / ID:{" "}
                      {
                        company.taxId
                      }
                    </div>
                  )}
                </div>

                {canManageRelations &&
                  !clientIsArchived && (
                    <form
                      action={
                        unlinkClientFromCompany
                      }
                    >
                      <input
                        type="hidden"
                        name="clientId"
                        value={
                          clientId
                        }
                      />

                      <input
                        type="hidden"
                        name="companyId"
                        value={
                          company.id
                        }
                      />

                      <button
                        type="submit"
                        className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-medium text-red-700 transition hover:bg-red-50"
                      >
                        Удалить связь
                      </button>
                    </form>
                  )}
              </div>
            ),
          )}
        </div>
      )}

      {canManageRelations &&
        !clientIsArchived && (
          <div className="mt-6 border-t border-slate-200 pt-6">
            <h3 className="text-sm font-semibold">
              Связать с компанией
            </h3>

            {availableCompanies.length >
            0 ? (
              <form
                action={
                  linkClientToCompany
                }
                className="mt-4 flex flex-wrap items-end gap-3"
              >
                <input
                  type="hidden"
                  name="clientId"
                  value={
                    clientId
                  }
                />

                <div className="min-w-64 flex-1">
                  <label
                    htmlFor="companyId"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Компания
                  </label>

                  <select
                    id="companyId"
                    name="companyId"
                    required
                    defaultValue=""
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-slate-500"
                  >
                    <option
                      value=""
                      disabled
                    >
                      Выберите компанию
                    </option>

                    {availableCompanies.map(
                      (
                        company,
                      ) => (
                        <option
                          key={
                            company.id
                          }
                          value={
                            company.id
                          }
                        >
                          {
                            company.name
                          }
                          {company.taxId
                            ? ` — ${company.taxId}`
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
                  Добавить связь
                </button>
              </form>
            ) : (
              <p className="mt-3 text-sm text-slate-500">
                Все доступные
                активные компании уже
                связаны с клиентом.
              </p>
            )}
          </div>
        )}
    </section>
  );
}