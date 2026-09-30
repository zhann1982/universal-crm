import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { DEFAULT_ROLES, DEFAULT_STAGES } from "./defaults";
import { PERMISSIONS } from "@/modules/access/permission-catalog";

process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/unused";

test("organization onboarding runs atomically in PostgreSQL", async (t) => {
  const pg = new PGlite();
  t.after(() => pg.close());
  for (const name of (await readdir("drizzle")).filter((name) => name.endsWith(".sql")).sort()) {
    await pg.exec(await readFile(`drizzle/${name}`, "utf8"));
  }
  const { sql } = await import("@/db");
  const { createOrganization } = await import("./create-organization");
  type Statement = { query: string; params: unknown[] };
  // Execute the production transaction's actual statements, including its lock.
  t.mock.method(sql, "transaction", async (build: (tx: { query: (query: string, params: unknown[]) => Statement }) => Statement[]) => {
    const statements = build({ query: (query, params) => ({ query, params }) });
    assert.match(statements[0].query, /pg_advisory_xact_lock/);
    return pg.transaction(async (tx) => {
      const results = [];
      for (const statement of statements) results.push((await tx.query(statement.query, statement.params)).rows);
      return results;
    });
  });
  const userId = randomUUID();
  const otherUserId = randomUUID();
  const unverifiedId = randomUUID();
  for (const [id, verified] of [[userId, true], [otherUserId, true], [unverifiedId, false]] as const) {
    await pg.query('INSERT INTO "user" (id, name, email, email_verified) VALUES ($1, $2, $3, $4)', [id, "Real owner", `${id}@example.com`, verified]);
  }
  const requestId = randomUUID();
  let organizationId: string;
  async function counts() {
    return (await pg.query(`SELECT
      (SELECT count(*) FROM organizations) AS organizations,
      (SELECT count(*) FROM roles) AS roles,
      (SELECT count(*) FROM organization_members) AS members,
      (SELECT count(*) FROM pipelines) AS pipelines,
      (SELECT count(*) FROM pipeline_stages) AS stages,
      (SELECT count(*) FROM organization_creations) AS requests,
      (SELECT count(*) FROM permissions) AS permissions,
      (SELECT count(*) FROM member_roles) AS assignments,
      (SELECT count(*) FROM role_permissions) AS grants`)).rows;
  }
  await t.test("creates an immediately usable tenant and derives owner identity from auth", async () => {
    const result = await createOrganization(userId, { requestId, name: "  My company  " });
    assert.equal(result.status, "created");
    assert.ok(result.organizationId);
    organizationId = result.organizationId;
    assert.deepEqual((await pg.query("SELECT name FROM organizations WHERE id = $1", [organizationId])).rows, [{ name: "My company" }]);
    assert.deepEqual((await pg.query(`SELECT m.user_id, m.display_name, m.email, r.system_key FROM organization_members m
      JOIN member_roles mr ON mr.member_id = m.id JOIN roles r ON r.id = mr.role_id WHERE m.organization_id = $1`, [organizationId])).rows,
      [{ user_id: userId, display_name: "Real owner", email: `${userId}@example.com`, system_key: "owner" }]);
    for (const role of DEFAULT_ROLES) {
      const keys = (await pg.query<{ key: string }>(`SELECT p.key FROM roles r JOIN role_permissions rp ON rp.role_id = r.id
        JOIN permissions p ON p.id = rp.permission_id WHERE r.organization_id = $1 AND r.system_key = $2 ORDER BY p.key`, [organizationId, role.systemKey])).rows.map((row) => row.key);
      assert.deepEqual(keys, [...role.permissions].sort());
    }
    assert.equal((await pg.query("SELECT id FROM permissions")).rows.length, PERMISSIONS.length);
    const pipeline = (await pg.query<{ id: string }>("SELECT id FROM pipelines WHERE organization_id = $1 AND is_default AND NOT is_archived", [organizationId])).rows;
    assert.equal(pipeline.length, 1);
    assert.deepEqual((await pg.query("SELECT name, type, position, probability FROM pipeline_stages WHERE pipeline_id = $1 AND organization_id = $2 ORDER BY position", [pipeline[0].id, organizationId])).rows, DEFAULT_STAGES);
  });
  await t.test("retry returns the same organization without changing name or adding records", async () => {
    const before = await counts();
    assert.deepEqual(await createOrganization(userId, { requestId, name: "Different name" }), { organizationId, status: "existing" });
    assert.deepEqual(await counts(), before);
    assert.deepEqual((await pg.query("SELECT name FROM organizations WHERE id = $1", [organizationId])).rows, [{ name: "My company" }]);
  });
  await t.test("a second verified creator can use the same request key without accessing the first tenant", async () => {
    const result = await createOrganization(otherUserId, { requestId, name: "Other company" });
    assert.equal(result.status, "created");
    assert.notEqual(result.organizationId, organizationId);
    assert.deepEqual((await pg.query("SELECT user_id FROM organization_members WHERE organization_id = $1", [result.organizationId])).rows, [{ user_id: otherUserId }]);
  });
  await t.test("missing and unverified users cannot create any records", async () => {
    const before = await counts();
    for (const id of [randomUUID(), unverifiedId]) {
      assert.deepEqual(await createOrganization(id, { requestId: randomUUID(), name: "Forbidden" }), { organizationId: null, status: "identity-invalid" });
    }
    assert.deepEqual(await counts(), before);
  });
  await t.test("replay never reassigns Owner after the creator's role changes", async () => {
    await pg.query(`UPDATE member_roles SET role_id = (SELECT id FROM roles WHERE organization_id = $1 AND system_key = 'viewer')
      WHERE member_id = (SELECT id FROM organization_members WHERE organization_id = $1 AND user_id = $2)`, [organizationId, userId]);
    const before = await counts();
    assert.equal((await createOrganization(userId, { requestId, name: "Retry" })).status, "existing");
    assert.deepEqual(await counts(), before);
    assert.deepEqual((await pg.query(`SELECT r.system_key FROM member_roles mr JOIN roles r ON r.id = mr.role_id
      JOIN organization_members m ON m.id = mr.member_id WHERE m.organization_id = $1 AND m.user_id = $2`, [organizationId, userId])).rows, [{ system_key: "viewer" }]);
  });
  await t.test("revoked access is never restored by replaying onboarding", async () => {
    await pg.query("UPDATE organization_members SET status = 'inactive' WHERE organization_id = $1", [organizationId]);
    const before = await counts();
    assert.deepEqual(await createOrganization(userId, { requestId, name: "Retry" }), { organizationId: null, status: "unavailable" });
    assert.deepEqual(await counts(), before);
    await pg.query("UPDATE organization_members SET status = 'active' WHERE organization_id = $1", [organizationId]);
    await pg.query("UPDATE organizations SET is_active = false WHERE id = $1", [organizationId]);
    assert.deepEqual(await createOrganization(userId, { requestId, name: "Retry" }), { organizationId: null, status: "unavailable" });
  });
  await t.test("a stage failure rolls back the organization, roles, owner and retry key", async () => {
    await pg.exec(`CREATE FUNCTION reject_onboarding_stage() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'stage failure'; END; $$;
      CREATE TRIGGER reject_onboarding_stage BEFORE INSERT ON pipeline_stages FOR EACH ROW EXECUTE FUNCTION reject_onboarding_stage();`);
    const failedRequest = randomUUID();
    const before = await counts();
    await assert.rejects(createOrganization(userId, { requestId: failedRequest, name: "Rollback" }), /stage failure/);
    assert.deepEqual(await counts(), before);
    await pg.exec("DROP TRIGGER reject_onboarding_stage ON pipeline_stages; DROP FUNCTION reject_onboarding_stage();");
    assert.equal((await createOrganization(userId, { requestId: failedRequest, name: "Retry after failure" })).status, "created");
  });
  await t.test("invalid drafts are rejected before the database transaction", async () => {
    const before = await counts();
    for (const name of ["   ", "x".repeat(161)]) await assert.rejects(createOrganization(userId, { requestId: randomUUID(), name }));
    await assert.rejects(createOrganization(userId, { requestId: "invalid", name: "Company" }));
    assert.deepEqual(await counts(), before);
  });
});
