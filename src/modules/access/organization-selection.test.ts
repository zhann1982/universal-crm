import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/unused";

test("organization selection revalidates membership against PostgreSQL", async (t) => {
  const pg = new PGlite();
  t.after(() => pg.close());
  for (const name of (await readdir("drizzle")).filter((name) => name.endsWith(".sql")).sort()) {
    await pg.exec(await readFile(`drizzle/${name}`, "utf8"));
  }
  const { sql } = await import("@/db");
  const { listAccessibleOrganizations, findAccessibleOrganization, resolveSelectedOrganization, matchesOrganizationScope } = await import("./organization-selection");
  t.mock.method(sql, "query", async (query: string, params: unknown[]) => {
    const result = await pg.query(query, params);
    return { ...result, rows: result.rows.map((row) => result.fields.map((field) => (row as Record<string, unknown>)[field.name])) };
  });
  const userId = randomUUID();
  const first = randomUUID();
  const second = randomUUID();
  const foreign = randomUUID();
  for (const [id, name] of [[first, "Alpha"], [second, "Beta"], [foreign, "Private"]]) {
    await pg.query("INSERT INTO organizations (id, name, slug) VALUES ($1, $2, $3)", [id, name, id]);
  }
  await pg.query("INSERT INTO organization_members (organization_id, user_id) VALUES ($1, $2), ($3, $4)", [first, userId, foreign, randomUUID()]);

  await t.test("a single active membership works without a preference cookie", async () => {
    assert.equal((await resolveSelectedOrganization(userId, undefined))?.id, first);
    assert.deepEqual((await listAccessibleOrganizations(userId)).map((org) => org.id), [first]);
  });
  await t.test("multiple memberships require an explicit selection", async () => {
    await pg.query("INSERT INTO organization_members (organization_id, user_id) VALUES ($1, $2)", [second, userId]);
    assert.equal(await resolveSelectedOrganization(userId, undefined), null);
    assert.equal((await resolveSelectedOrganization(userId, second))?.id, second);
    assert.deepEqual((await listAccessibleOrganizations(userId)).map((org) => org.id), [first, second]);
  });
  await t.test("foreign, malformed and deleted selections grant no access", async () => {
    for (const id of [foreign, randomUUID(), "invalid", "", "development"]) {
      assert.equal(await resolveSelectedOrganization(userId, id), null);
    }
    assert.equal(await findAccessibleOrganization(randomUUID(), first), null);
    assert.deepEqual(await listAccessibleOrganizations(randomUUID()), []);
  });
  await t.test("old forms cannot create or mutate in the newly selected tenant", () => {
    assert.equal(matchesOrganizationScope(first, first), true);
    for (const scope of [first, null, undefined, "", "invalid", new FormData()]) {
      assert.equal(matchesOrganizationScope(second, scope), false);
    }
    assert.equal(matchesOrganizationScope(second, second), true);
  });
  await t.test("revoking membership invalidates the cookie without silent tenant fallback", async () => {
    await pg.query("UPDATE organization_members SET status = 'inactive' WHERE organization_id = $1 AND user_id = $2", [second, userId]);
    assert.equal(await resolveSelectedOrganization(userId, second), null);
    assert.deepEqual((await listAccessibleOrganizations(userId)).map((org) => org.id), [first]);
    assert.equal((await resolveSelectedOrganization(userId, undefined))?.id, first);
    assert.equal(await resolveSelectedOrganization(userId, foreign), null);
  });
  await t.test("deactivating an organization invalidates even an active membership", async () => {
    await pg.query("UPDATE organizations SET is_active = false WHERE id = $1", [first]);
    assert.equal(await resolveSelectedOrganization(userId, first), null);
    assert.equal(await resolveSelectedOrganization(userId, undefined), null);
    assert.deepEqual(await listAccessibleOrganizations(userId), []);
  });
});
