"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { clients } from "@/db/schema";
import { getCurrentOrganization } from "@/lib/current-organization";
import {
  createClientSchema,
  type CreateClientState,
} from "@/lib/validation/client";

export async function createClient(
  _previousState: CreateClientState,
  formData: FormData,
): Promise<CreateClientState> {
  const values = {
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

  const result =
    createClientSchema.safeParse(values);

  if (!result.success) {
    return {
      errors: result.error.flatten().fieldErrors,
      values,
      message:
        "Проверьте данные формы.",
    };
  }

  const organization =
    await getCurrentOrganization();

  try {
    await db.insert(clients).values({
      organizationId: organization.id,

      firstName: result.data.firstName,
      lastName: result.data.lastName,
      middleName: result.data.middleName,

      phone: result.data.phone,
      email: result.data.email,

      status: result.data.status,
      source: result.data.source,
      notes: result.data.notes,
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