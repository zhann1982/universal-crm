import {
  redirect,
} from "next/navigation";

import {
  getOrganizationForAccessBySlug,
} from "@/modules/access/tenant-access";

export async function getCurrentOrganization() {
  /*
   * Пока CRM работает с одной
   * development-организацией.
   *
   * В дальнейшем здесь появится
   * выбор текущей организации
   * пользователя.
   */
  const result =
    await getOrganizationForAccessBySlug(
      "development",
    );

  if (
    result.status ===
    "not-found"
  ) {
    throw new Error(
      "Development organization not found",
    );
  }

  if (
    result.status ===
    "inactive"
  ) {
    redirect(
      "/no-access?reason=organization-inactive",
    );
  }

  return result.organization;
}
