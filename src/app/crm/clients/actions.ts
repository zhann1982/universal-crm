"use server";

import {
  and,
  eq,
  isNull,
} from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { clients } from "@/db/schema";
import { getCurrentOrganization } from "@/lib/current-organization";
import {
  clientIdSchema,
  createClientSchema,
  updateClientSchema,
  type CreateClientState,
  type UpdateClientState,
} from "@/lib/validation/client";

function getFormValues(formData: FormData) {
  return {
    firstName: String(
      formData.get("firstName") ?? "",
    ),

    lastName: String(
      formData.get("lastName") ?? "",
    ),

    middleName: String(
      formData.get("middleName") ?? "",
    ),

    phone: String(
      formData.get("phone") ?? "",
    ),

    email: String(
      formData.get("email") ?? "",
    ),

    status: String(
      formData.get("status") ?? "active",
    ),

    source: String(
      formData.get("source") ?? "",
    ),

    notes: String(
      formData.get("notes") ?? "",
    ),
  };
}

export async function createClient(
  _previousState: CreateClientState,
  formData: FormData,
): Promise<CreateClientState> {
  const values =
    getFormValues(formData);

  const result =
    createClientSchema.safeParse(values);

  if (!result.success) {
    return {
      errors:
        result.error.flatten().fieldErrors,

      values,

      message:
        "Проверьте данные формы.",
    };
  }

  const organization =
    await getCurrentOrganization();

  try {
    await db.insert(clients).values({
      organizationId:
        organization.id,

      firstName:
        result.data.firstName,

      lastName:
        result.data.lastName,

      middleName:
        result.data.middleName,

      phone:
        result.data.phone,

      email:
        result.data.email,

      status:
        result.data.status,

      source:
        result.data.source,

      notes:
        result.data.notes,
    });
  } catch (error) {
    console.error(
      "Failed to create client:",
      error,
    );

    return {
      values,

      message:
        "Не удалось создать клиента. Попробуйте ещё раз.",
    };
  }

  revalidatePath("/crm");
  revalidatePath("/crm/clients");

  redirect("/crm/clients");
}

export async function updateClient(
  clientId: string,
  _previousState: UpdateClientState,
  formData: FormData,
): Promise<UpdateClientState> {
  const idResult =
    clientIdSchema.safeParse(clientId);

  if (!idResult.success) {
    return {
      message:
        "Некорректный идентификатор клиента.",
    };
  }

  const values =
    getFormValues(formData);

  const result =
    updateClientSchema.safeParse(values);

  if (!result.success) {
    return {
      errors:
        result.error.flatten().fieldErrors,

      values,

      message:
        "Проверьте данные формы.",
    };
  }

  const organization =
    await getCurrentOrganization();

  try {
    const updated =
      await db
        .update(clients)
        .set({
          firstName:
            result.data.firstName,

          lastName:
            result.data.lastName,

          middleName:
            result.data.middleName,

          phone:
            result.data.phone,

          email:
            result.data.email,

          status:
            result.data.status,

          source:
            result.data.source,

          notes:
            result.data.notes,

          updatedAt: new Date(),
        })
        .where(
          and(
            eq(
              clients.id,
              idResult.data,
            ),

            eq(
              clients.organizationId,
              organization.id,
            ),

            eq(
              clients.isArchived,
              false,
            ),

            isNull(
              clients.deletedAt,
            ),
          ),
        )
        .returning({
          id: clients.id,
        });

    if (updated.length === 0) {
      return {
        values,

        message:
          "Клиент не найден или недоступен для редактирования.",
      };
    }
  } catch (error) {
    console.error(
      "Failed to update client:",
      error,
    );

    return {
      values,

      message:
        "Не удалось сохранить изменения.",
    };
  }

  revalidatePath("/crm");
  revalidatePath("/crm/clients");

  revalidatePath(
    `/crm/clients/${idResult.data}`,
  );

  redirect(
    `/crm/clients/${idResult.data}`,
  );
}

export async function archiveClient(
  clientId: string,
) {
  const idResult =
    clientIdSchema.safeParse(clientId);

  if (!idResult.success) {
    redirect("/crm/clients");
  }

  const organization =
    await getCurrentOrganization();

  await db
    .update(clients)
    .set({
      isArchived: true,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(
          clients.id,
          idResult.data,
        ),

        eq(
          clients.organizationId,
          organization.id,
        ),

        eq(
          clients.isArchived,
          false,
        ),

        isNull(
          clients.deletedAt,
        ),
      ),
    );

  revalidatePath("/crm");
  revalidatePath("/crm/clients");

  revalidatePath(
    `/crm/clients/${idResult.data}`,
  );

  redirect("/crm/clients");
}

export async function restoreClient(
  clientId: string,
) {
  const idResult =
    clientIdSchema.safeParse(clientId);

  if (!idResult.success) {
    redirect("/crm/clients?view=archive");
  }

  const organization =
    await getCurrentOrganization();

  await db
    .update(clients)
    .set({
      isArchived: false,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(
          clients.id,
          idResult.data,
        ),

        eq(
          clients.organizationId,
          organization.id,
        ),

        eq(
          clients.isArchived,
          true,
        ),

        isNull(
          clients.deletedAt,
        ),
      ),
    );

  revalidatePath("/crm");
  revalidatePath("/crm/clients");

  revalidatePath(
    `/crm/clients/${idResult.data}`,
  );

  redirect(
    `/crm/clients/${idResult.data}`,
  );
}