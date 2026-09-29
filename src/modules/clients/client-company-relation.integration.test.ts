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
  organizations,
} from "@/db/schema";

import {
  linkClientCompany,
  unlinkClientCompany,
} from "./client-company-relation";

type Fixture = {
  organizationId: string;
  clientId: string;
  companyId: string;
};

async function createFixture():
  Promise<Fixture> {
  const suffix =
    randomUUID();

  const [organization] =
    await db
      .insert(
        organizations,
      )
      .values({
        name:
          `Relation test ${suffix}`,
        slug:
          `relation-test-${suffix}`,
      })
      .returning({
        id:
          organizations.id,
      });

  assert.ok(
    organization,
  );

  const [client] =
    await db
      .insert(clients)
      .values({
        organizationId:
          organization.id,
        firstName:
          "Relation",
        lastName:
          "Client",
      })
      .returning({
        id: clients.id,
      });

  assert.ok(client);

  const [company] =
    await db
      .insert(companies)
      .values({
        organizationId:
          organization.id,
        name:
          `Relation Company ${suffix}`,
      })
      .returning({
        id: companies.id,
      });

  assert.ok(company);

  return {
    organizationId:
      organization.id,
    clientId:
      client.id,
    companyId:
      company.id,
  };
}

async function cleanupFixture(
  organizationId: string,
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

async function relationCount(
  fixture: Fixture,
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
            fixture.organizationId,
          ),
          eq(
            clientCompanies.clientId,
            fixture.clientId,
          ),
          eq(
            clientCompanies.companyId,
            fixture.companyId,
          ),
        ),
      );

  return rows.length;
}

test(
  "archived Client cannot be linked to Company",
  async () => {
    const fixture =
      await createFixture();

    try {
      await db
        .update(clients)
        .set({
          isArchived: true,
        })
        .where(
          eq(
            clients.id,
            fixture.clientId,
          ),
        );

      const result =
        await linkClientCompany(
          fixture,
        );

      assert.deepEqual(
        result,
        {
          status:
            "client-unavailable",
        },
      );

      assert.equal(
        await relationCount(
          fixture,
        ),
        0,
      );
    } finally {
      await cleanupFixture(
        fixture.organizationId,
      );
    }
  },
);

test(
  "archived Client cannot unlink an existing Company relation",
  async () => {
    const fixture =
      await createFixture();

    try {
      await db
        .insert(
          clientCompanies,
        )
        .values({
          organizationId:
            fixture.organizationId,
          clientId:
            fixture.clientId,
          companyId:
            fixture.companyId,
        });

      await db
        .update(clients)
        .set({
          isArchived: true,
        })
        .where(
          eq(
            clients.id,
            fixture.clientId,
          ),
        );

      const result =
        await unlinkClientCompany(
          fixture,
        );

      assert.deepEqual(
        result,
        {
          status:
            "client-unavailable",
        },
      );

      assert.equal(
        await relationCount(
          fixture,
        ),
        1,
      );
    } finally {
      await cleanupFixture(
        fixture.organizationId,
      );
    }
  },
);

test(
  "active Client may unlink an archived Company relation",
  async () => {
    const fixture =
      await createFixture();

    try {
      await db
        .insert(
          clientCompanies,
        )
        .values({
          organizationId:
            fixture.organizationId,
          clientId:
            fixture.clientId,
          companyId:
            fixture.companyId,
        });

      await db
        .update(companies)
        .set({
          isArchived: true,
        })
        .where(
          eq(
            companies.id,
            fixture.companyId,
          ),
        );

      const result =
        await unlinkClientCompany(
          fixture,
        );

      assert.deepEqual(
        result,
        {
          status:
            "unlinked",
        },
      );

      assert.equal(
        await relationCount(
          fixture,
        ),
        0,
      );
    } finally {
      await cleanupFixture(
        fixture.organizationId,
      );
    }
  },
);
