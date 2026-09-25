"use server";

import {
  and,
  eq,
} from "drizzle-orm";
import {
  revalidatePath,
} from "next/cache";
import {
  redirect,
} from "next/navigation";

import { db } from "@/db";
import {
  companies,
  organizationMembers,
} from "@/db/schema";
import {
  requirePermission,
} from "@/lib/auth/permissions";
import {
  createCompanySchema,
  type CreateCompanyState,
} from "@/lib/validation/company";

function getFormValues(
  formData: FormData,
) {
  return {
    name: String(
      formData.get("name") ??
        "",
    ),

    legalName: String(
      formData.get("legalName") ??
        "",
    ),

    taxId: String(
      formData.get("taxId") ??
        "",
    ),

    phone: String(
      formData.get("phone") ??
        "",
    ),

    email: String(
      formData.get("email") ??
        "",
    ),

    website: String(
      formData.get("website") ??
        "",
    ),

    industry: String(
      formData.get("industry") ??
        "",
    ),

    address: String(
      formData.get("address") ??
        "",
    ),

    status: String(
      formData.get("status") ??
        "active",
    ),

    ownerMemberId: String(
      formData.get(
        "ownerMemberId",
      ) ?? "",
    ),

    notes: String(
      formData.get("notes") ??
        "",
    ),
  };
}

export async function createCompany(
  _previousState:
    CreateCompanyState,

  formData: FormData,
): Promise<CreateCompanyState> {
  const {
    organization,
  } = await requirePermission(
    "companies.create",
  );

  const values =
    getFormValues(
      formData,
    );

  const result =
    createCompanySchema.safeParse(
      values,
    );

  if (!result.success) {
    return {
      errors:
        result.error.flatten()
          .fieldErrors,

      values,

      message:
        "Проверьте данные формы.",
    };
  }

  const data =
    result.data;

  if (
    data.ownerMemberId
  ) {
    const [owner] =
      await db
        .select({
          id:
            organizationMembers.id,
        })
        .from(
          organizationMembers,
        )
        .where(
          and(
            eq(
              organizationMembers.id,
              data.ownerMemberId,
            ),

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
        .limit(1);

    if (!owner) {
      return {
        values,

        errors: {
          ownerMemberId: [
            "Ответственный сотрудник недоступен.",
          ],
        },

        message:
          "Проверьте данные формы.",
      };
    }
  }

  if (data.taxId) {
    const [duplicate] =
      await db
        .select({
          id: companies.id,
        })
        .from(companies)
        .where(
          and(
            eq(
              companies.organizationId,
              organization.id,
            ),

            eq(
              companies.taxId,
              data.taxId,
            ),
          ),
        )
        .limit(1);

    if (duplicate) {
      return {
        values,

        errors: {
          taxId: [
            "Компания с таким налоговым ID уже существует.",
          ],
        },

        message:
          "Компания с таким налоговым ID уже существует.",
      };
    }
  }

  try {
    await db
      .insert(companies)
      .values({
        organizationId:
          organization.id,

        ownerMemberId:
          data.ownerMemberId,

        name:
          data.name,

        legalName:
          data.legalName,

        taxId:
          data.taxId,

        phone:
          data.phone,

        email:
          data.email,

        website:
          data.website,

        industry:
          data.industry,

        address:
          data.address,

        status:
          data.status,

        notes:
          data.notes,
      });
  } catch (error) {
    console.error(
      "Failed to create company:",
      error,
    );

    return {
      values,

      message:
        "Не удалось создать компанию. Попробуйте ещё раз.",
    };
  }

  revalidatePath(
    "/crm",
  );

  revalidatePath(
    "/crm/companies",
  );

  redirect(
    "/crm/companies",
  );
}
