import {
  asc,
  and,
  eq,
} from "drizzle-orm";
import Link from "next/link";

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
  } = await requirePermission(
    "companies.create",
  );

  const members =
    await db
      .select({
        id:
          organizationMembers.id,

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