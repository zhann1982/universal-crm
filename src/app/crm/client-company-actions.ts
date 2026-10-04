"use server";

import { redirectWithNotice } from "@/modules/notifications/redirect";

import {
  revalidatePath,
} from "next/cache";
import {
  redirect,
} from "next/navigation";
import { z } from "zod";

import {
  requireMutationPermission,
} from "@/lib/auth/permissions";
import {
  linkClientCompany,
  unlinkClientCompany,
} from "@/modules/clients/client-company-relation";

const relationSchema =
  z.object({
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
      formData.get(
        "clientId",
      ) ?? "",
    ),

    companyId: String(
      formData.get(
        "companyId",
      ) ?? "",
    ),
  });
}

function relationForbidden(
  status: string,
) {
  return (
    status ===
      "client-unavailable" ||
    status ===
      "company-unavailable"
  );
}

export async function linkClientToCompany(
  formData: FormData,
) {
  const {
    organization,
    permissions,
  } = await requireMutationPermission(
    "clients.update",
    formData,
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

  const parsed =
    parseRelation(
      formData,
    );

  if (!parsed.success) {
    redirect(
      "/crm/clients",
    );
  }

  const result =
    await linkClientCompany({
      organizationId:
        organization.id,

      clientId:
        parsed.data.clientId,

      companyId:
        parsed.data.companyId,
    });

  if (
    relationForbidden(
      result.status,
    )
  ) {
    redirect(
      "/crm/forbidden",
    );
  }

  revalidatePath(
    `/crm/clients/${parsed.data.clientId}`,
  );

  revalidatePath(
    `/crm/companies/${parsed.data.companyId}`,
  );

  redirectWithNotice(`/crm/clients/${parsed.data.clientId}`, "company-linked");
}

export async function unlinkClientFromCompany(
  formData: FormData,
) {
  const {
    organization,
    permissions,
  } = await requireMutationPermission(
    "clients.update",
    formData,
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

  const parsed =
    parseRelation(
      formData,
    );

  if (!parsed.success) {
    redirect(
      "/crm/clients",
    );
  }

  const result =
    await unlinkClientCompany({
      organizationId:
        organization.id,

      clientId:
        parsed.data.clientId,

      companyId:
        parsed.data.companyId,
    });

  if (
    relationForbidden(
      result.status,
    )
  ) {
    redirect(
      "/crm/forbidden",
    );
  }

  revalidatePath(
    `/crm/clients/${parsed.data.clientId}`,
  );

  revalidatePath(
    `/crm/companies/${parsed.data.companyId}`,
  );

  redirectWithNotice(`/crm/clients/${parsed.data.clientId}`, "company-unlinked");
}
