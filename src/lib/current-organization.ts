import { eq } from "drizzle-orm";
import {
  redirect,
} from "next/navigation";

import { db } from "@/db";
import {
  organizations,
} from "@/db/schema";

export async function getCurrentOrganization() {
  /*
   * Пока CRM работает с одной
   * development-организацией.
   *
   * В дальнейшем здесь появится
   * выбор текущей организации
   * пользователя.
   */
  const [organization] =
    await db
      .select()
      .from(
        organizations,
      )
      .where(
        eq(
          organizations.slug,
          "development",
        ),
      )
      .limit(1);

  if (!organization) {
    throw new Error(
      "Development organization not found",
    );
  }

  /*
   * Неактивная организация
   * не должна иметь доступ
   * к данным CRM.
   *
   * При этом данные организации
   * не удаляются — доступ можно
   * восстановить повторной
   * активацией.
   */
  if (
    !organization.isActive
  ) {
    redirect(
      "/no-access?reason=organization-inactive",
    );
  }

  return organization;
}