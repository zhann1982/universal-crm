"use server";

import {
  and,
  eq,
  isNull,
} from "drizzle-orm";
import {
  revalidatePath,
} from "next/cache";
import {
  redirect,
} from "next/navigation";
import { z } from "zod";

import { db } from "@/db";
import {
  clientCompanies,
  clients,
  companies,
} from "@/db/schema";
import {
  requirePermission,
} from "@/lib/auth/permissions";

const relationSchema = z.object({
  clientId:
    z.string().uuid(),

  companyId:
    z.string().uuid(),
});

function parseRelation(
  formData: FormData,
) {
  return relationSchema.safeParse({
    clientId: String(
      formData.get("clientId") ??
        "",
    ),

    companyId: String(
      formData.get("companyId") ??
        "",
    ),
  });
}

export async function linkClientToCompany(
  formData: FormData,
) {
  const {
    organization,
    permissions,
  } = await requirePermission(
    "clients.update",
  );

  if (
    !permissions.has(
      "companies.read",
    )
  ) {
    redirect(
      "/crm/forbidden",
    );
  }

  const result =
    parseRelation(
      formData,
    );

  if (!result.success) {
    redirect(
      "/crm/clients",
    );
  }

  const {
    clientId,
    companyId,
  } = result.data;

  const [client] =
    await db
      .select({
        id: clients.id,
      })
      .from(clients)
      .where(
        and(
          eq(
            clients.id,
            clientId,
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
      .limit(1);

  const [company] =
    await db
      .select({
        id: companies.id,
      })
      .from(companies)
      .where(
        and(
          eq(
            companies.id,
            companyId,
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

  if (
    !client ||
    !company
  ) {
    redirect(
      "/crm/forbidden",
    );
  }

  await db
    .insert(
      clientCompanies,
    )
    .values({
      organizationId:
        organization.id,

      clientId:
        client.id,

      companyId:
        company.id,
    })
    .onConflictDoNothing();

  revalidatePath(
    `/crm/clients/${client.id}`,
  );

  revalidatePath(
    `/crm/companies/${company.id}`,
  );

  redirect(
    `/crm/clients/${client.id}`,
  );
}

export async function unlinkClientFromCompany(
  formData: FormData,
) {
  const {
    organization,
    permissions,
  } = await requirePermission(
    "clients.update",
  );

  if (
    !permissions.has(
      "companies.read",
    )
  ) {
    redirect(
      "/crm/forbidden",
    );
  }

  const result =
    parseRelation(
      formData,
    );

  if (!result.success) {
    redirect(
      "/crm/clients",
    );
  }

  const {
    clientId,
    companyId,
  } = result.data;

  /*
   * Архивированный Client считается
   * недоступным для изменения связей.
   *
   * Раньше unlink проверял только
   * deletedAt и поэтому прямой вызов
   * Server Action мог изменить связь
   * архивированного Client.
   */
  const [client] =
    await db
      .select({
        id:
          clients.id,
      })
      .from(
        clients,
      )
      .where(
        and(
          eq(
            clients.id,
            clientId,
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
      .limit(1);

  /*
   * Для unlink сохраняем текущую
   * семантику Company:
   *
   * существующую связь разрешено
   * удалить даже если Company уже
   * находится в архиве.
   *
   * F11 относится именно к
   * immutable-состоянию Client.
   */
  const [company] =
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
            companies.id,
            companyId,
          ),

          eq(
            companies.organizationId,
            organization.id,
          ),

          isNull(
            companies.deletedAt,
          ),
        ),
      )
      .limit(1);

  if (
    !client ||
    !company
  ) {
    redirect(
      "/crm/forbidden",
    );
  }

  const deleted =
    await db
      .delete(
        clientCompanies,
      )
      .where(
        and(
          eq(
            clientCompanies.organizationId,
            organization.id,
          ),

          eq(
            clientCompanies.clientId,
            client.id,
          ),

          eq(
            clientCompanies.companyId,
            company.id,
          ),
        ),
      )
      .returning({
        clientId:
          clientCompanies.clientId,

        companyId:
          clientCompanies.companyId,
      });

  /*
   * Если связи уже нет, это безопасный
   * idempotent результат.
   *
   * Никакие чужие или cross-tenant
   * записи при этом не изменяются.
   */
  if (
    deleted.length === 0
  ) {
    redirect(
      `/crm/clients/${client.id}`,
    );
  }

  revalidatePath(
    `/crm/clients/${client.id}`,
  );

  revalidatePath(
    `/crm/companies/${company.id}`,
  );

  redirect(
    `/crm/clients/${client.id}`,
  );
}