"use server";

import {
  and,
  eq,
  isNull,
  ne,
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
} from "@/db/schema";
import {
  requireMutationPermission,
} from "@/lib/auth/permissions";
import {
  companyIdSchema,
  createCompanySchema,
  updateCompanySchema,
  type CreateCompanyState,
  type UpdateCompanyState,
} from "@/lib/validation/company";
import {
  resolveOwnerAssignment,
} from "@/modules/members/owner-assignment";

function getFormValues(
  formData: FormData,
) {
  return {
    name: String(
      formData.get("name") ?? "",
    ),

    legalName: String(
      formData.get("legalName") ?? "",
    ),

    taxId: String(
      formData.get("taxId") ?? "",
    ),

    phone: String(
      formData.get("phone") ?? "",
    ),

    email: String(
      formData.get("email") ?? "",
    ),

    website: String(
      formData.get("website") ?? "",
    ),

    industry: String(
      formData.get("industry") ?? "",
    ),

    address: String(
      formData.get("address") ?? "",
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
      formData.get("notes") ?? "",
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
    member,
    permissions,
  } = await requireMutationPermission(
    "companies.create",
    formData,
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

  /*
   * F05 + active Membership validation.
   *
   * Без members.read пользователь
   * может назначить только себя
   * или оставить owner пустым.
   *
   * Любой новый non-null owner
   * дополнительно должен быть
   * активным Member этой Organization.
   */
  const ownerResult =
    await resolveOwnerAssignment({
      organizationId:
        organization.id,

      mode:
        "create",

      currentMemberId:
        member.id,

      canReadMembers:
        permissions.has(
          "members.read",
        ),

      requestedOwnerMemberId:
        data.ownerMemberId,
    });

  if (
    ownerResult.status ===
    "forbidden"
  ) {
    return {
      values,

      errors: {
        ownerMemberId: [
          "Нельзя назначить этого сотрудника.",
        ],
      },

      message:
        "Проверьте данные формы.",
    };
  }

  if (
    ownerResult.status ===
    "owner-unavailable"
  ) {
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

  revalidatePath("/crm");
  revalidatePath(
    "/crm/companies",
  );

  redirect(
    "/crm/companies",
  );
}

export async function updateCompany(
  companyId: string,

  _previousState:
    UpdateCompanyState,

  formData: FormData,
): Promise<UpdateCompanyState> {
  const {
    organization,
    member,
    permissions,
  } = await requireMutationPermission(
    "companies.update",
    formData,
  );

  const idResult =
    companyIdSchema.safeParse(
      companyId,
    );

  if (!idResult.success) {
    return {
      message:
        "Некорректный идентификатор компании.",
    };
  }

  const values =
    getFormValues(
      formData,
    );

  const result =
    updateCompanySchema.safeParse(
      values,
    );

  if (!result.success) {
    return {
      errors:
        result.error
          .flatten()
          .fieldErrors,

      values,

      message:
        "Проверьте данные формы.",
    };
  }

  const data =
    result.data;

  /*
   * Сначала читаем текущее
   * состояние Company.
   *
   * Это нужно в том числе,
   * чтобы определить, меняется
   * ли owner.
   */
  const [existingCompany] =
    await db
      .select({
        id:
          companies.id,

        ownerMemberId:
          companies.ownerMemberId,
      })
      .from(
        companies,
      )
      .where(
        and(
          eq(
            companies.id,
            idResult.data,
          ),

          eq(
            companies.organizationId,
            organization.id,
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
      .limit(1);

  if (!existingCompany) {
    return {
      values,

      message:
        "Компания не найдена или недоступна для редактирования.",
    };
  }

  /*
   * F05 + F08.
   *
   * Неизменённый owner может
   * остаться даже если Membership
   * уже стала inactive.
   *
   * Новый non-null owner должен:
   * - пройти permission policy;
   * - принадлежать этой Organization;
   * - иметь active Membership.
   */
  const ownerResult =
    await resolveOwnerAssignment({
      organizationId:
        organization.id,

      mode:
        "update",

      currentMemberId:
        member.id,

      canReadMembers:
        permissions.has(
          "members.read",
        ),

      requestedOwnerMemberId:
        data.ownerMemberId,

      existingOwnerMemberId:
        existingCompany.ownerMemberId,
    });

  if (
    ownerResult.status ===
    "forbidden"
  ) {
    return {
      values,

      errors: {
        ownerMemberId: [
          "Нельзя назначить этого сотрудника.",
        ],
      },

      message:
        "Проверьте данные формы.",
    };
  }

  if (
    ownerResult.status ===
    "owner-unavailable"
  ) {
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

  if (
    data.taxId
  ) {
    const [duplicate] =
      await db
        .select({
          id:
            companies.id,
        })
        .from(
          companies,
        )
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

            ne(
              companies.id,
              idResult.data,
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
    const updated =
      await db
        .update(
          companies,
        )
        .set({
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

          updatedAt:
            new Date(),
        })
        .where(
          and(
            eq(
              companies.id,
              existingCompany.id,
            ),

            eq(
              companies.organizationId,
              organization.id,
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
        .returning({
          id:
            companies.id,
        });

    if (
      updated.length === 0
    ) {
      return {
        values,

        message:
          "Компания не найдена или недоступна для редактирования.",
      };
    }
  } catch (error) {
    console.error(
      "Failed to update company:",
      error,
    );

    return {
      values,

      message:
        "Не удалось сохранить изменения.",
    };
  }

  revalidatePath(
    "/crm",
  );

  revalidatePath(
    "/crm/companies",
  );

  revalidatePath(
    `/crm/companies/${existingCompany.id}`,
  );

  redirect(
    `/crm/companies/${existingCompany.id}`,
  );
}

export async function archiveCompany(
  organizationScope: string,
  companyId: string,
) {
  const {
    organization,
  } = await requireMutationPermission(
    "companies.archive",
    organizationScope,
  );

  const idResult =
    companyIdSchema.safeParse(
      companyId,
    );

  if (!idResult.success) {
    redirect(
      "/crm/companies",
    );
  }

  await db
    .update(companies)
    .set({
      isArchived: true,

      updatedAt:
        new Date(),
    })
    .where(
      and(
        eq(
          companies.id,
          idResult.data,
        ),

        eq(
          companies.organizationId,
          organization.id,
        ),

        eq(
          companies.isArchived,
          false,
        ),

        isNull(
          companies.deletedAt,
        ),
      ),
    );

  revalidatePath("/crm");

  revalidatePath(
    "/crm/companies",
  );

  revalidatePath(
    `/crm/companies/${idResult.data}`,
  );

  redirect(
    "/crm/companies",
  );
}

export async function restoreCompany(
  organizationScope: string,
  companyId: string,
  destination:
    | "detail"
    | "list" = "detail",
) {
  const {
    organization,
  } = await requireMutationPermission(
    "companies.archive",
    organizationScope,
  );

  const idResult =
    companyIdSchema.safeParse(
      companyId,
    );

  if (!idResult.success) {
    redirect(
      "/crm/companies?view=archive",
    );
  }

  await db
    .update(companies)
    .set({
      isArchived: false,

      updatedAt:
        new Date(),
    })
    .where(
      and(
        eq(
          companies.id,
          idResult.data,
        ),

        eq(
          companies.organizationId,
          organization.id,
        ),

        eq(
          companies.isArchived,
          true,
        ),

        isNull(
          companies.deletedAt,
        ),
      ),
    );

  revalidatePath(
    "/crm",
  );

  revalidatePath(
    "/crm/companies",
  );

  revalidatePath(
    `/crm/companies/${idResult.data}`,
  );

  if (
    destination === "list"
  ) {
    redirect(
      "/crm/companies",
    );
  }

  redirect(
    `/crm/companies/${idResult.data}`,
  );
}
