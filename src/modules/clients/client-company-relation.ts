import {
  and,
  eq,
  isNull,
} from "drizzle-orm";

import { db } from "@/db";
import {
  clientCompanies,
  clients,
  companies,
} from "@/db/schema";

export type ClientCompanyRelationInput = {
  organizationId: string;
  clientId: string;
  companyId: string;
};

export type LinkClientCompanyResult =
  | { status: "linked" }
  | { status: "already-linked" }
  | { status: "client-unavailable" }
  | { status: "company-unavailable" };

export async function linkClientCompany(
  input: ClientCompanyRelationInput,
): Promise<LinkClientCompanyResult> {
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
            input.clientId,
          ),
          eq(
            clients.organizationId,
            input.organizationId,
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

  if (!client) {
    return {
      status:
        "client-unavailable",
    };
  }

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
            input.companyId,
          ),
          eq(
            companies.organizationId,
            input.organizationId,
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

  if (!company) {
    return {
      status:
        "company-unavailable",
    };
  }

  const inserted =
    await db
      .insert(
        clientCompanies,
      )
      .values({
        organizationId:
          input.organizationId,
        clientId:
          client.id,
        companyId:
          company.id,
      })
      .onConflictDoNothing()
      .returning({
        clientId:
          clientCompanies.clientId,
      });

  if (
    inserted.length === 0
  ) {
    return {
      status:
        "already-linked",
    };
  }

  return {
    status: "linked",
  };
}

export type UnlinkClientCompanyResult =
  | { status: "unlinked" }
  | { status: "not-linked" }
  | { status: "client-unavailable" }
  | { status: "company-unavailable" };

export async function unlinkClientCompany(
  input: ClientCompanyRelationInput,
): Promise<UnlinkClientCompanyResult> {
  /*
   * F11:
   * archived Client is immutable
   * for relationship mutations.
   */
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
            input.clientId,
          ),
          eq(
            clients.organizationId,
            input.organizationId,
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

  if (!client) {
    return {
      status:
        "client-unavailable",
    };
  }

  /*
   * Existing relation may be removed
   * even when Company is archived.
   */
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
            input.companyId,
          ),
          eq(
            companies.organizationId,
            input.organizationId,
          ),
          isNull(
            companies.deletedAt,
          ),
        ),
      )
      .limit(1);

  if (!company) {
    return {
      status:
        "company-unavailable",
    };
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
            input.organizationId,
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
      });

  if (
    deleted.length === 0
  ) {
    return {
      status:
        "not-linked",
    };
  }

  return {
    status: "unlinked",
  };
}
