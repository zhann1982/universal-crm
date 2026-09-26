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
  organizationMembers,
} from "@/db/schema";
import {
  requirePermission,
} from "@/lib/auth/permissions";
import {
  companyIdSchema,
  createCompanySchema,
  updateCompanySchema,
  type CreateCompanyState,
  type UpdateCompanyState,
} from "@/lib/validation/company";

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

async function isValidOwner(
  organizationId: string,
  ownerMemberId:
    | string
    | null,
) {
  if (!ownerMemberId) {
    return true;
  }

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
            ownerMemberId,
          ),

          eq(
            organizationMembers.organizationId,
            organizationId,
          ),

          eq(
            organizationMembers.status,
            "active",
          ),
        ),
      )
      .limit(1);

  return Boolean(owner);
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
    !(await isValidOwner(
      organization.id,
      data.ownerMemberId,
    ))
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
  } = await requirePermission(
    "companies.update",
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
   * чтобы понять, действительно
   * ли пользователь меняет owner.
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
   * F08.
   *
   * Если ответственный НЕ меняется,
   * разрешаем сохранить компанию,
   * даже если текущий owner уже
   * стал неактивным.
   *
   * Но назначить нового
   * неактивного сотрудника
   * по-прежнему нельзя.
   */
  const ownerChanged =
    data.ownerMemberId !==
    existingCompany.ownerMemberId;

  if (
    ownerChanged &&
    !(await isValidOwner(
      organization.id,
      data.ownerMemberId,
    ))
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
  companyId: string,
) {
  const {
    organization,
  } = await requirePermission(
    "companies.archive",
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
  companyId: string,
  destination:
    | "detail"
    | "list" = "detail",
) {
  const {
    organization,
  } = await requirePermission(
    "companies.archive",
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