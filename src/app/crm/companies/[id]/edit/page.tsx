import {
  and,
  asc,
  eq,
  or,
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
  EditCompanyForm,
} from "./edit-company-form";

export default async function EditCompanyPage({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  const {
    organization,
  } = await requirePermission(
    "companies.update",
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

  if (
    !company ||
    company.isArchived
  ) {
    notFound();
  }

  const memberStatusCondition =
    company.ownerMemberId
      ? or(
          eq(
            organizationMembers.status,
            "active",
          ),

          eq(
            organizationMembers.id,
            company.ownerMemberId,
          ),
        )
      : eq(
          organizationMembers.status,
          "active",
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

        status:
          organizationMembers.status,
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

          memberStatusCondition,
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
          href={`/crm/companies/${company.id}`}
          className="text-sm text-slate-500 transition hover:text-slate-900"
        >
          ← Назад к компании
        </Link>

        <h1 className="mt-4 text-3xl font-bold">
          Редактирование компании
        </h1>

        <p className="mt-2 text-slate-500">
          Измените данные
          компании.
        </p>
      </div>

      <EditCompanyForm
        company={company}
        members={members}
      />
    </div>
  );
}