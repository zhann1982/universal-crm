import {
  randomUUID,
} from "node:crypto";
import assert from "node:assert/strict";
import test from "node:test";

import {
  and,
  eq,
} from "drizzle-orm";

import { db } from "@/db";
import {
  clientCompanies,
  clients,
  companies,
  organizationInvitations,
  organizationMembers,
  organizations,
  roles,
} from "@/db/schema";

import {
  linkClientCompany,
  unlinkClientCompany,
} from "@/modules/clients/client-company-relation";
import {
  createInvitation,
} from "@/modules/invitations/create-invitation";

type TenantFixture = {
  organizationId: string;
  memberId: string;
  roleId: string;
  clientId: string;
  companyId: string;
};

async function createTenant(
  label: string,
): Promise<TenantFixture> {
  const suffix =
    randomUUID();

  const [organization] =
    await db
      .insert(organizations)
      .values({
        name:
          `Tenant boundary ${label} ${suffix}`,
        slug:
          `tenant-boundary-${label}-${suffix}`,
      })
      .returning({
        id:
          organizations.id,
      });

  assert.ok(organization);

  const [member] =
    await db
      .insert(
        organizationMembers,
      )
      .values({
        organizationId:
          organization.id,
        userId:
          `tenant-user-${label}-${suffix}`,
        displayName:
          `Tenant ${label} Member`,
        status:
          "active",
      })
      .returning({
        id:
          organizationMembers.id,
      });

  assert.ok(member);

  const [role] =
    await db
      .insert(roles)
      .values({
        organizationId:
          organization.id,
        name:
          `Tenant ${label} Role ${suffix}`,
        isSystem:
          false,
      })
      .returning({
        id:
          roles.id,
      });

  assert.ok(role);

  const [client] =
    await db
      .insert(clients)
      .values({
        organizationId:
          organization.id,
        firstName:
          `Tenant ${label}`,
        lastName:
          "Client",
      })
      .returning({
        id:
          clients.id,
      });

  assert.ok(client);

  const [company] =
    await db
      .insert(companies)
      .values({
        organizationId:
          organization.id,
        name:
          `Tenant ${label} Company ${suffix}`,
      })
      .returning({
        id:
          companies.id,
      });

  assert.ok(company);

  return {
    organizationId:
      organization.id,
    memberId:
      member.id,
    roleId:
      role.id,
    clientId:
      client.id,
    companyId:
      company.id,
  };
}

async function cleanupTenants(
  ...organizationIds: string[]
) {
  for (
    const organizationId
    of organizationIds
  ) {
    await db
      .delete(organizations)
      .where(
        eq(
          organizations.id,
          organizationId,
        ),
      );
  }
}

async function relationExists(
  organizationId: string,
  clientId: string,
  companyId: string,
) {
  const rows =
    await db
      .select({
        clientId:
          clientCompanies.clientId,
      })
      .from(clientCompanies)
      .where(
        and(
          eq(
            clientCompanies.organizationId,
            organizationId,
          ),
          eq(
            clientCompanies.clientId,
            clientId,
          ),
          eq(
            clientCompanies.companyId,
            companyId,
          ),
        ),
      );

  return rows.length > 0;
}

async function invitationCount(
  organizationId: string,
) {
  const rows =
    await db
      .select({
        id:
          organizationInvitations.id,
      })
      .from(
        organizationInvitations,
      )
      .where(
        eq(
          organizationInvitations.organizationId,
          organizationId,
        ),
      );

  return rows.length;
}

test(
  "tenant A cannot link its Client to tenant B Company",
  async () => {
    const tenantA =
      await createTenant("A");
    const tenantB =
      await createTenant("B");

    try {
      const result =
        await linkClientCompany({
          organizationId:
            tenantA.organizationId,
          clientId:
            tenantA.clientId,
          companyId:
            tenantB.companyId,
        });

      assert.deepEqual(
        result,
        {
          status:
            "company-unavailable",
        },
      );

      assert.equal(
        await relationExists(
          tenantA.organizationId,
          tenantA.clientId,
          tenantB.companyId,
        ),
        false,
      );
    } finally {
      await cleanupTenants(
        tenantA.organizationId,
        tenantB.organizationId,
      );
    }
  },
);

test(
  "tenant A cannot link tenant B Client to its Company",
  async () => {
    const tenantA =
      await createTenant("A");
    const tenantB =
      await createTenant("B");

    try {
      const result =
        await linkClientCompany({
          organizationId:
            tenantA.organizationId,
          clientId:
            tenantB.clientId,
          companyId:
            tenantA.companyId,
        });

      assert.deepEqual(
        result,
        {
          status:
            "client-unavailable",
        },
      );

      assert.equal(
        await relationExists(
          tenantA.organizationId,
          tenantB.clientId,
          tenantA.companyId,
        ),
        false,
      );
    } finally {
      await cleanupTenants(
        tenantA.organizationId,
        tenantB.organizationId,
      );
    }
  },
);

test(
  "tenant A cannot unlink tenant B Client-Company relation",
  async () => {
    const tenantA =
      await createTenant("A");
    const tenantB =
      await createTenant("B");

    try {
      await db
        .insert(
          clientCompanies,
        )
        .values({
          organizationId:
            tenantB.organizationId,
          clientId:
            tenantB.clientId,
          companyId:
            tenantB.companyId,
        });

      const result =
        await unlinkClientCompany({
          organizationId:
            tenantA.organizationId,
          clientId:
            tenantB.clientId,
          companyId:
            tenantB.companyId,
        });

      assert.deepEqual(
        result,
        {
          status:
            "client-unavailable",
        },
      );

      assert.equal(
        await relationExists(
          tenantB.organizationId,
          tenantB.clientId,
          tenantB.companyId,
        ),
        true,
      );
    } finally {
      await cleanupTenants(
        tenantA.organizationId,
        tenantB.organizationId,
      );
    }
  },
);

test(
  "tenant A cannot create invitation using tenant B inviter",
  async () => {
    const tenantA =
      await createTenant("A");
    const tenantB =
      await createTenant("B");

    try {
      const result =
        await createInvitation({
          organizationId:
            tenantA.organizationId,
          invitedByMemberId:
            tenantB.memberId,
          email:
            `foreign-inviter-${randomUUID()}@example.com`,
          roleId:
            tenantA.roleId,
        });

      assert.deepEqual(
        result,
        {
          status:
            "inviter-invalid",
        },
      );

      assert.equal(
        await invitationCount(
          tenantA.organizationId,
        ),
        0,
      );
    } finally {
      await cleanupTenants(
        tenantA.organizationId,
        tenantB.organizationId,
      );
    }
  },
);

test(
  "tenant A cannot create invitation using tenant B Role",
  async () => {
    const tenantA =
      await createTenant("A");
    const tenantB =
      await createTenant("B");

    try {
      const result =
        await createInvitation({
          organizationId:
            tenantA.organizationId,
          invitedByMemberId:
            tenantA.memberId,
          email:
            `foreign-role-${randomUUID()}@example.com`,
          roleId:
            tenantB.roleId,
        });

      assert.deepEqual(
        result,
        {
          status:
            "role-not-found",
        },
      );

      assert.equal(
        await invitationCount(
          tenantA.organizationId,
        ),
        0,
      );
    } finally {
      await cleanupTenants(
        tenantA.organizationId,
        tenantB.organizationId,
      );
    }
  },
);
