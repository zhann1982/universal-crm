import {
  and,
  eq,
} from "drizzle-orm";
import Link from "next/link";
import {
  notFound,
} from "next/navigation";

import { db } from "@/db";
import {
  organizationMembers,
} from "@/db/schema";
import {
  requirePermission,
} from "@/lib/auth/permissions";
import {
  getCompanyById,
} from "@/lib/companies/get-company";
import {
  companyIdSchema,
} from "@/lib/validation/company";

import {
  ArchiveCompanyButton,
} from "./archive-company-button";
import {
  RestoreCompanyButton,
} from "./restore-company-button";

const statusLabels:
  Record<string, string> = {
    active: "Активная",
    prospect:
      "Потенциальная",
    inactive:
      "Неактивная",
  };

export default async function CompanyPage({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  const {
    organization,
    permissions:
      currentPermissions,
  } = await requirePermission(
    "companies.read",
  );

  const { id } =
    await params;

  const idResult =
    companyIdSchema.safeParse(
      id,
    );

  if (!idResult.success) {
    notFound();
  }

  const company =
    await getCompanyById(
      idResult.data,
    );

  if (!company) {
    notFound();
  }

  let owner:
    | {
        displayName:
          | string
          | null;
        email:
          | string
          | null;
      }
    | undefined;

  if (
    company.ownerMemberId
  ) {
    [owner] =
      await db
        .select({
          displayName:
            organizationMembers.displayName,

          email:
            organizationMembers.email,
        })
        .from(
          organizationMembers,
        )
        .where(
          and(
            eq(
              organizationMembers.id,
              company.ownerMemberId,
            ),

            eq(
              organizationMembers.organizationId,
              organization.id,
            ),
          ),
        )
        .limit(1);
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8">
        <Link
          href={
            company.isArchived
              ? "/crm/companies?view=archive"
              : "/crm/companies"
          }
          className="text-sm text-slate-500 transition hover:text-slate-900"
        >
          ← Назад к компаниям
        </Link>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold">
                {company.name}
              </h1>

              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium">
                {statusLabels[
                  company.status
                ] ??
                  company.status}
              </span>

              {company.isArchived && (
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
                  В архиве
                </span>
              )}
            </div>

            {company.legalName && (
              <p className="mt-2 text-slate-500">
                {
                  company.legalName
                }
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            {!company.isArchived &&
              currentPermissions.has(
                "companies.update",
              ) && (
                <Link
                  href={`/crm/companies/${company.id}/edit`}
                  className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium transition hover:bg-slate-50"
                >
                  Редактировать
                </Link>
              )}

            {!company.isArchived &&
              currentPermissions.has(
                "companies.archive",
              ) && (
                <ArchiveCompanyButton
                  companyId={
                    company.id
                  }
                />
              )}

            {company.isArchived &&
              currentPermissions.has(
                "companies.archive",
              ) && (
                <RestoreCompanyButton
                  companyId={
                    company.id
                  }
                />
              )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
          <h2 className="text-lg font-semibold">
            Информация о компании
          </h2>

          <dl className="mt-6 grid gap-6 sm:grid-cols-2">
            <InfoItem
              label="Название"
              value={
                company.name
              }
            />

            <InfoItem
              label="Юридическое название"
              value={
                company.legalName
              }
            />

            <InfoItem
              label="БИН / налоговый ID"
              value={
                company.taxId
              }
            />

            <InfoItem
              label="Отрасль"
              value={
                company.industry
              }
            />

            <InfoItem
              label="Телефон"
              value={
                company.phone
              }
            />

            <InfoItem
              label="Email"
              value={
                company.email
              }
            />

            <InfoItem
              label="Веб-сайт"
              value={
                company.website
              }
            />

            <InfoItem
              label="Адрес"
              value={
                company.address
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
              label="Статус"
              value={
                statusLabels[
                  company.status
                ] ??
                company.status
              }
            />

            <InfoItem
              label="Ответственный"
              value={
                owner
                  ?.displayName ||
                owner?.email
              }
            />

            <InfoItem
              label="Создана"
              value={company.createdAt.toLocaleString(
                "ru-RU",
              )}
            />

            <InfoItem
              label="Обновлена"
              value={company.updatedAt.toLocaleString(
                "ru-RU",
              )}
            />
          </dl>
        </section>
      </div>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">
          Заметки
        </h2>

        {company.notes ? (
          <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">
            {company.notes}
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