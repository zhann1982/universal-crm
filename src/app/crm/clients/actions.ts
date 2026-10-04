"use server";
import { creationValues } from "@/modules/custom-fields/persistence";

import { redirectWithNotice } from "@/modules/notifications/redirect";

import {
  and,
  eq,
  isNull,
} from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { recordMutation } from "@/modules/activity/mutation-context";
import { clients } from "@/db/schema";
import { requireMutationPermission } from "@/lib/auth/permissions";
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

  const { organization, member } =
  await requireMutationPermission(
    "clients.create",
    formData,
  );
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

  let customData;
  try {
    customData = await creationValues(organization.id, "client", formData);
  } catch (error) {
    const known = error instanceof Error && !("code" in error) &&
      /^(Заполните поле|Поле «|Настройка полей|Неизвестное поле|Некорректные значения)/.test(error.message);
    return {
      values,
      message: known ? error.message : "Не удалось проверить пользовательские поля.",
    };
  }
  try {
    await recordMutation({ organizationId: organization.id, memberId: member.id }, () => db.insert(clients).values({
      ...customData,
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
    }));
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

  redirectWithNotice("/crm/clients", "client-created");
}

export async function updateClient(
  clientId: string,
  _previousState: UpdateClientState,
  formData: FormData,
): Promise<UpdateClientState> {

  const { organization, member } =
    await requireMutationPermission(
      "clients.update",
    formData,
  );
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

  try {
    const updated =
      await recordMutation({ organizationId: organization.id, memberId: member.id }, () => db
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
        }));

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

  redirectWithNotice(`/crm/clients/${idResult.data}`, "client-updated");
}

export async function archiveClient(
  organizationScope: string,
  clientId: string,
) {
  const { organization, member } =
    await requireMutationPermission(
      "clients.archive",
    organizationScope,
  );
  const idResult =
    clientIdSchema.safeParse(clientId);

  if (!idResult.success) {
    redirect("/crm/clients");
  }

  const changed = await recordMutation({ organizationId: organization.id, memberId: member.id }, () => db
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
    ).returning({ id: clients.id }));

  if (!changed.length) redirect("/crm/clients?error=lifecycle-conflict");

  revalidatePath("/crm");
  revalidatePath("/crm/clients");

  revalidatePath(
    `/crm/clients/${idResult.data}`,
  );

  redirectWithNotice("/crm/clients", "client-archived");
}

export async function restoreClient(
  organizationScope: string,
  clientId: string,
) {
  const { organization, member } =
  await requireMutationPermission(
    "clients.archive",
    organizationScope,
  );
  const idResult =
    clientIdSchema.safeParse(clientId);

  if (!idResult.success) {
    redirect("/crm/clients?view=archive");
  }

  const changed = await recordMutation({ organizationId: organization.id, memberId: member.id }, () => db
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
    ).returning({ id: clients.id }));

  if (!changed.length) redirect("/crm/clients?error=lifecycle-conflict");

  revalidatePath("/crm");
  revalidatePath("/crm/clients");

  revalidatePath(
    `/crm/clients/${idResult.data}`,
  );

  redirectWithNotice(`/crm/clients/${idResult.data}`, "client-restored");
}