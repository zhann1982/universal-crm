import {
  and,
  asc,
  eq,
} from "drizzle-orm";
import Link from "@/components/app-link";

import { db } from "@/db";
import {
  organizationMembers,
} from "@/db/schema";
import {
  requirePermission,
} from "@/lib/auth/permissions";

import {
  CompanyForm,
} from "./company-form";

export default async function NewCompanyPage() {
  const {
    organization,
    member,
    permissions,
  } = await requirePermission(
    "companies.create",
  );

  /*
   * F05.
   *
   * Пользователь с members.read
   * может выбирать любого
   * активного сотрудника.
   *
   * Пользователь без members.read
   * получает только самого себя.
   *
   * Email сотрудников для
   * owner-picker не загружается.
   */
  let members: Array<{
    id: string;

    displayName:
      | string
      | null;
  }>;

  if (
    permissions.has(
      "members.read",
    )
  ) {
    members =
      await db
        .select({
          id:
            organizationMembers.id,

          displayName:
            organizationMembers.displayName,
        })
        .from(
          organizationMembers,
        )
        .where(
          and(
            eq(
              organizationMembers.organizationId,
              organization.id,
            ),

            eq(
              organizationMembers.status,
              "active",
            ),
          ),
        )
        .orderBy(
          asc(
            organizationMembers.displayName,
          ),
        );
  } else {
    members = [
      {
        id:
          member.id,

        displayName:
          member.displayName,
      },
    ];
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8">
        <Link
          href="/crm/companies"
          className="text-sm text-slate-500 transition hover:text-slate-900"
        >
          ← Назад к компаниям
        </Link>

        <h1 className="mt-4 text-3xl font-bold">
          Новая компания
        </h1>

        <p className="mt-2 text-slate-500">
          Добавьте организацию
          или юридическое лицо
          в CRM.
        </p>
      </div>

      <CompanyForm
        members={members}
      />
    </div>
  );
}