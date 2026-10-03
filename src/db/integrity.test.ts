import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

const migrationName = "0013_tenant_integrity.sql";

test("Drizzle migration journal installs the complete schema and safely replays", async (t) => {
  const pg = new PGlite();
  t.after(() => pg.close());
  const db = drizzle(pg);
  await migrate(db, { migrationsFolder: "drizzle" });
  const ids = await fixture(pg);
  await pg.query("INSERT INTO member_roles (organization_id, member_id, role_id) VALUES ($1, $2, $3)", [ids.org, ids.member, ids.role]);
  const before = (await pg.query("SELECT * FROM member_roles")).rows;
  await migrate(db, { migrationsFolder: "drizzle" });
  assert.deepEqual((await pg.query("SELECT * FROM member_roles")).rows, before);
  assert.equal((await pg.query("SELECT * FROM drizzle.__drizzle_migrations")).rows.length, 16);
});

async function previousSchema(pg: PGlite) {
  for (const name of (await readdir("drizzle")).filter((name) => name.endsWith(".sql") && name < migrationName).sort()) {
    await pg.exec(await readFile(`drizzle/${name}`, "utf8"));
  }
}

async function fixture(pg: PGlite) {
  const ids = {
    org: randomUUID(), otherOrg: randomUUID(), pipeline: randomUUID(), secondPipeline: randomUUID(),
    foreignPipeline: randomUUID(), stage: randomUUID(), secondStage: randomUUID(), foreignStage: randomUUID(),
    member: randomUUID(), foreignMember: randomUUID(), role: randomUUID(), foreignRole: randomUUID(),
    client: randomUUID(), foreignClient: randomUUID(), company: randomUUID(), foreignCompany: randomUUID(),
    deal: randomUUID(),
  };
  for (const org of [ids.org, ids.otherOrg]) {
    await pg.query("INSERT INTO organizations (id, name, slug) VALUES ($1::uuid, 'Test', ($1::uuid)::text)", [org]);
  }
  for (const [id, org] of [[ids.pipeline, ids.org], [ids.secondPipeline, ids.org], [ids.foreignPipeline, ids.otherOrg]]) {
    await pg.query("INSERT INTO pipelines (id, organization_id, name) VALUES ($1::uuid, $2, ($1::uuid)::text)", [id, org]);
  }
  for (const [id, org, pipeline, position] of [[ids.stage, ids.org, ids.pipeline, 0], [ids.secondStage, ids.org, ids.secondPipeline, 1], [ids.foreignStage, ids.otherOrg, ids.foreignPipeline, 2]] as const) {
    await pg.query("INSERT INTO pipeline_stages (id, organization_id, pipeline_id, name, position) VALUES ($1, $2, $3, $1::uuid::text, $4)", [id, org, pipeline, position]);
  }
  for (const [member, role, org] of [[ids.member, ids.role, ids.org], [ids.foreignMember, ids.foreignRole, ids.otherOrg]]) {
    await pg.query("INSERT INTO organization_members (id, organization_id, user_id) VALUES ($1::uuid, $2, ($1::uuid)::text)", [member, org]);
    await pg.query("INSERT INTO roles (id, organization_id, name, system_key) VALUES ($1, $2, 'Owner', 'owner')", [role, org]);
  }
  for (const [client, company, org, member] of [[ids.client, ids.company, ids.org, ids.member], [ids.foreignClient, ids.foreignCompany, ids.otherOrg, ids.foreignMember]]) {
    await pg.query("INSERT INTO clients (id, organization_id, first_name, owner_member_id) VALUES ($1, $2, 'Client', $3)", [client, org, member]);
    await pg.query("INSERT INTO companies (id, organization_id, name, owner_member_id) VALUES ($1, $2, 'Company', $3)", [company, org, member]);
    await pg.query("INSERT INTO client_companies (organization_id, client_id, company_id) VALUES ($1, $2, $3)", [org, client, company]);
  }
  await pg.query(`INSERT INTO deals (id, organization_id, pipeline_id, stage_id, title, owner_member_id, company_id, amount, currency)
    VALUES ($1, $2, $3, $4, 'Deal', $5, $6, 0, 'KZT')`, [ids.deal, ids.org, ids.pipeline, ids.stage, ids.member, ids.company]);
  return ids;
}

function constraint(name: string) {
  return (error: unknown) => {
    const pgError = error as { code?: string; constraint?: string };
    assert.ok(["23503", "23514"].includes(pgError.code ?? ""));
    assert.equal(pgError.constraint, name);
    return true;
  };
}

test("CRM tenant constraints upgrade populated PostgreSQL and protect direct writes", async (t) => {
  const pg = new PGlite();
  t.after(() => pg.close());
  await previousSchema(pg);
  const ids = await fixture(pg);
  // Simulate a real upgrade, with role assignments predating organization_id.
  await pg.query("INSERT INTO member_roles (member_id, role_id) VALUES ($1, $2)", [ids.member, ids.role]);
  const migration = await readFile(`drizzle/${migrationName}`, "utf8");
  await pg.transaction((tx) => tx.exec(migration));

  await t.test("existing assignments are backfilled without changing identity or role", async () => {
    assert.deepEqual((await pg.query("SELECT organization_id, member_id, role_id FROM member_roles")).rows,
      [{ organization_id: ids.org, member_id: ids.member, role_id: ids.role }]);
    assert.deepEqual((await pg.query("SELECT amount, currency, version FROM deals WHERE id = $1", [ids.deal])).rows,
      [{ amount: "0.00", currency: "KZT", version: 1 }]);
  });

  await t.test("a stage cannot belong to a foreign pipeline on insert or update", async () => {
    await assert.rejects(pg.query("INSERT INTO pipeline_stages (organization_id, pipeline_id, name, position) VALUES ($1, $2, 'Foreign', 9)", [ids.org, ids.foreignPipeline]), constraint("pipeline_stages_org_pipeline_fk"));
    await assert.rejects(pg.query("UPDATE pipeline_stages SET pipeline_id = $1 WHERE id = $2", [ids.foreignPipeline, ids.secondStage]), constraint("pipeline_stages_org_pipeline_fk"));
  });

  await t.test("a deal cannot use another tenant's pipeline", async () => {
    await assert.rejects(pg.query("UPDATE deals SET pipeline_id = $1, stage_id = $2 WHERE id = $3", [ids.foreignPipeline, ids.foreignStage, ids.deal]), constraint("deals_org_pipeline_fk"));
  });

  await t.test("a deal cannot mix stages from another pipeline in the same tenant", async () => {
    await assert.rejects(pg.query("UPDATE deals SET stage_id = $1 WHERE id = $2", [ids.secondStage, ids.deal]), constraint("deals_org_pipeline_stage_fk"));
    await assert.rejects(pg.query("INSERT INTO deals (organization_id, pipeline_id, stage_id, title) VALUES ($1, $2, $3, 'Invalid')", [ids.org, ids.pipeline, ids.secondStage]), constraint("deals_org_pipeline_stage_fk"));
  });

  await t.test("a pipeline and stage can change together within the tenant", async () => {
    await pg.query("UPDATE deals SET pipeline_id = $1, stage_id = $2 WHERE id = $3", [ids.secondPipeline, ids.secondStage, ids.deal]);
    await pg.query("UPDATE deals SET pipeline_id = $1, stage_id = $2 WHERE id = $3", [ids.pipeline, ids.stage, ids.deal]);
  });

  await t.test("foreign company and owner references fail for every core entity", async () => {
    await assert.rejects(pg.query("UPDATE deals SET company_id = $1 WHERE id = $2", [ids.foreignCompany, ids.deal]), constraint("deals_org_company_fk"));
    for (const [table, id] of [["clients", ids.client], ["companies", ids.company], ["deals", ids.deal]]) {
      await assert.rejects(pg.query(`UPDATE ${table} SET owner_member_id = $1 WHERE id = $2`, [ids.foreignMember, id]), constraint(`${table}_org_owner_fk`));
    }
  });

  await t.test("client-company links reject a forged tenant on insert and update", async () => {
    await assert.rejects(pg.query("INSERT INTO client_companies (organization_id, client_id, company_id) VALUES ($1, $2, $3)", [ids.org, ids.foreignClient, ids.company]), constraint("client_companies_org_client_fk"));
    await assert.rejects(pg.query("UPDATE client_companies SET company_id = $1 WHERE client_id = $2", [ids.foreignCompany, ids.client]), constraint("client_companies_org_company_fk"));
  });

  await t.test("role assignments cannot cross tenants through either relationship", async () => {
    await assert.rejects(pg.query("INSERT INTO member_roles (organization_id, member_id, role_id) VALUES ($1, $2, $3)", [ids.org, ids.foreignMember, ids.role]), constraint("member_roles_org_member_fk"));
    await assert.rejects(pg.query("UPDATE member_roles SET role_id = $1 WHERE member_id = $2", [ids.foreignRole, ids.member]), constraint("member_roles_org_role_fk"));
    await assert.rejects(pg.query("INSERT INTO member_roles (member_id, role_id) VALUES ($1, $2)", [ids.foreignMember, ids.foreignRole]), (error: unknown) => (error as { code: string }).code === "23502");
  });

  await t.test("referenced records cannot move to a different tenant or pipeline", async () => {
    const emptyOrg = randomUUID();
    await pg.query("INSERT INTO organizations (id, name, slug) VALUES ($1, 'Empty', $2)", [emptyOrg, emptyOrg]);
    for (const [table, id] of [["pipelines", ids.pipeline], ["pipeline_stages", ids.stage], ["organization_members", ids.member], ["roles", ids.role], ["clients", ids.client], ["companies", ids.company]]) {
      await assert.rejects(pg.query(`UPDATE ${table} SET organization_id = $1 WHERE id = $2`, [emptyOrg, id]), (error: unknown) => (error as { code: string }).code === "23503");
    }
    await assert.rejects(pg.query("UPDATE pipeline_stages SET pipeline_id = $1 WHERE id = $2", [ids.secondPipeline, ids.stage]), constraint("deals_org_pipeline_stage_fk"));
  });

  await t.test("stage types and probabilities reject invalid values and allow boundaries", async () => {
    for (const type of ["closed", "OPEN", ""]) {
      await assert.rejects(pg.query("UPDATE pipeline_stages SET type = $1 WHERE id = $2", [type, ids.stage]), constraint("pipeline_stages_type_check"));
    }
    for (const probability of [-1, 101]) {
      await assert.rejects(pg.query("UPDATE pipeline_stages SET probability = $1 WHERE id = $2", [probability, ids.stage]), constraint("pipeline_stages_probability_check"));
    }
    for (const probability of [0, 100]) await pg.query("UPDATE pipeline_stages SET probability = $1 WHERE id = $2", [probability, ids.stage]);
    for (const type of ["won", "lost", "open"]) await pg.query("UPDATE pipeline_stages SET type = $1 WHERE id = $2", [type, ids.stage]);
  });

  await t.test("money rejects negative, NaN and amounts without a valid currency", async () => {
    for (const [amount, currency] of [["-0.01", "KZT"], ["NaN", "KZT"], ["0", null], ["1", "usd"], [null, "12X"], [null, ""]]) {
      await assert.rejects(pg.query("UPDATE deals SET amount = $1, currency = $2 WHERE id = $3", [amount, currency, ids.deal]), constraint("deals_amount_currency_check"));
    }
    for (const [amount, currency] of [[null, null], [null, "USD"], ["0", "KZT"], ["999999999999.99", "EUR"]]) {
      await pg.query("UPDATE deals SET amount = $1, currency = $2 WHERE id = $3", [amount, currency, ids.deal]);
    }
  });

  await t.test("inactive owners survive unrelated edits, archive and restore", async () => {
    await pg.query("UPDATE organization_members SET status = 'inactive' WHERE id = $1", [ids.member]);
    await pg.query("UPDATE deals SET title = 'Edited', is_archived = true WHERE id = $1", [ids.deal]);
    await pg.query("UPDATE deals SET is_archived = false WHERE id = $1", [ids.deal]);
    assert.deepEqual((await pg.query("SELECT owner_member_id FROM deals WHERE id = $1", [ids.deal])).rows, [{ owner_member_id: ids.member }]);
  });

  await t.test("owner and company deletion retain existing SET NULL semantics", async () => {
    const local = await fixture(pg);
    await pg.query("DELETE FROM organization_members WHERE id = $1", [local.member]);
    for (const [table, id] of [["clients", local.client], ["companies", local.company], ["deals", local.deal]]) {
      assert.deepEqual((await pg.query(`SELECT owner_member_id, organization_id FROM ${table} WHERE id = $1`, [id])).rows, [{ owner_member_id: null, organization_id: local.org }]);
    }
    await pg.query("DELETE FROM companies WHERE id = $1", [local.company]);
    assert.deepEqual((await pg.query("SELECT company_id, organization_id FROM deals WHERE id = $1", [local.deal])).rows, [{ company_id: null, organization_id: local.org }]);
    assert.equal((await pg.query("SELECT * FROM client_companies WHERE client_id = $1", [local.client])).rows.length, 0);
  });

  await t.test("deleting a role cascades assignments and referenced pipelines remain protected", async () => {
    await pg.query("INSERT INTO member_roles (organization_id, member_id, role_id) VALUES ($1, $2, $3)", [ids.otherOrg, ids.foreignMember, ids.foreignRole]);
    await pg.query("DELETE FROM roles WHERE id = $1", [ids.foreignRole]);
    assert.equal((await pg.query("SELECT * FROM member_roles WHERE member_id = $1", [ids.foreignMember])).rows.length, 0);
    for (const [table, id] of [["pipeline_stages", ids.stage], ["pipelines", ids.pipeline]]) {
      await assert.rejects(pg.query(`DELETE FROM ${table} WHERE id = $1`, [id]), (error: unknown) => ["23503", "23001"].includes((error as { code: string }).code));
    }
  });

  await t.test("audit reports clean migrated data", async () => {
    const rows = (await pg.query<{ invariant: string; violations: number }>(await readFile("src/db/integrity-audit.sql", "utf8"))).rows;
    assert.equal(rows.length, 12);
    assert.ok(rows.every((row) => row.violations === 0));
  });
});

test("integrity preflight detects legacy violations and migration rolls back without repairing data", async (t) => {
  const pg = new PGlite();
  t.after(() => pg.close());
  await previousSchema(pg);
  const ids = await fixture(pg);
  await pg.query("INSERT INTO member_roles (member_id, role_id) VALUES ($1, $2)", [ids.member, ids.foreignRole]);
  await pg.query("UPDATE pipeline_stages SET probability = 101, type = 'invalid' WHERE id = $1", [ids.stage]);
  await pg.query("UPDATE deals SET pipeline_id = $1, owner_member_id = $2, company_id = $3, amount = -1, currency = NULL WHERE id = $4", [ids.foreignPipeline, ids.foreignMember, ids.foreignCompany, ids.deal]);
  await pg.query("UPDATE clients SET owner_member_id = $1 WHERE id = $2", [ids.foreignMember, ids.client]);
  await pg.query("UPDATE companies SET owner_member_id = $1 WHERE id = $2", [ids.foreignMember, ids.company]);
  await pg.query("UPDATE client_companies SET company_id = $1 WHERE client_id = $2", [ids.foreignCompany, ids.client]);
  // A separate unreferenced stage creates the remaining legacy tenant mismatch.
  await pg.query("UPDATE pipeline_stages SET organization_id = $1 WHERE id = $2", [ids.org, ids.foreignStage]);
  const audit = await readFile("src/db/integrity-audit.sql", "utf8");
  const before = (await pg.query<{ invariant: string; violations: number }>(audit)).rows;
  assert.ok(before.every((row) => row.violations > 0));
  await assert.rejects(pg.transaction(async (tx) => tx.exec(await readFile(`drizzle/${migrationName}`, "utf8"))), (error: unknown) => (error as { code: string }).code === "23503");
  assert.deepEqual((await pg.query(audit)).rows, before);
  assert.equal((await pg.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'member_roles' AND column_name = 'organization_id'")).rows.length, 0);
  assert.deepEqual((await pg.query("SELECT member_id, role_id FROM member_roles")).rows, [{ member_id: ids.member, role_id: ids.foreignRole }]);
});

test("invitation acceptance and Owner guard use tenant-scoped assignments atomically", async (t) => {
  process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/unused";
  const pg = new PGlite();
  t.after(() => pg.close());
  for (const name of (await readdir("drizzle")).filter((name) => name.endsWith(".sql")).sort()) {
    await pg.exec(await readFile(`drizzle/${name}`, "utf8"));
  }
  const ids = await fixture(pg);
  const { sql } = await import("@/db");
  const { acceptInvitation } = await import("@/modules/invitations/accept-invitation");
  const { createInvitationToken } = await import("@/modules/invitations/invitation-token");
  const { replaceMemberRolesWithOwnerGuard, updateMemberStatusWithOwnerGuard } = await import("@/modules/members/owner-guard");
  type Statement = { query: string; params: unknown[] };
  type Transaction = ((parts: TemplateStringsArray, ...params: unknown[]) => Statement) & {
    query: (query: string, params: unknown[]) => Statement;
  };
  // Run the real parameterized SQL and separate advisory-lock statements in PGlite.
  // This proves SQL compatibility/rollback, not multi-session Neon concurrency.
  t.mock.method(sql, "transaction", async (build: (tx: Transaction) => Statement[]) => {
    const txn = Object.assign((parts: TemplateStringsArray, ...params: unknown[]) => ({
      query: parts.reduce((query, part, index) => query + (index ? `$${index}` : "") + part, ""), params,
    }), { query: (query: string, params: unknown[]) => ({ query, params }) });
    const statements = build(txn);
    assert.match(statements[0].query, /pg_advisory_xact_lock/);
    return pg.transaction(async (tx) => {
      const results = [];
      for (const statement of statements) results.push((await tx.query(statement.query, statement.params)).rows);
      return results;
    });
  });
  const managerRole = randomUUID();
  await pg.query("INSERT INTO roles (id, organization_id, name, system_key) VALUES ($1, $2, 'Manager', 'manager')", [managerRole, ids.org]);
  await pg.query("INSERT INTO member_roles (organization_id, member_id, role_id) VALUES ($1, $2, $3)", [ids.org, ids.member, ids.role]);

  await t.test("role replacement writes organization scope and preserves last Owner protection", async () => {
    assert.equal((await replaceMemberRolesWithOwnerGuard({ organizationId: ids.org, memberId: ids.member, roleIds: [ids.role, managerRole] })).allowed, true);
    assert.equal((await pg.query("SELECT * FROM member_roles WHERE member_id = $1 AND organization_id = $2", [ids.member, ids.org])).rows.length, 2);
    const rejected = await replaceMemberRolesWithOwnerGuard({ organizationId: ids.org, memberId: ids.member, roleIds: [managerRole] });
    assert.equal(rejected.allowed, false);
    assert.equal(rejected.blocked_last_owner, true);
    const foreign = await replaceMemberRolesWithOwnerGuard({ organizationId: ids.org, memberId: ids.member, roleIds: [ids.foreignRole] });
    assert.equal(foreign.roles_valid, false);
    assert.equal((await pg.query("SELECT * FROM member_roles WHERE member_id = $1", [ids.member])).rows.length, 2);
  });

  async function invitation(roleId: string) {
    const token = createInvitationToken();
    const userId = randomUUID();
    const email = `${userId}@example.com`;
    const invitationId = randomUUID();
    await pg.query('INSERT INTO "user" (id, name, email, email_verified) VALUES ($1, $2, $3, true)', [userId, "Invited", email]);
    await pg.query(`INSERT INTO organization_invitations (id, organization_id, email_normalized, role_id, token_hash, expires_at)
      VALUES ($1, $2, $3, $4, $5, now() + interval '1 day')`, [invitationId, ids.org, email, roleId, token.tokenHash]);
    return { input: { token: token.token, userId, userEmail: email, userName: "Invited", emailVerified: true }, invitationId };
  }

  await t.test("acceptance creates one same-tenant membership and role, with safe replay", async () => {
    const invite = await invitation(ids.role);
    const accepted = await acceptInvitation(invite.input);
    assert.equal(accepted.status, "accepted");
    if (accepted.status !== "accepted") throw new Error("Expected accepted invitation");
    assert.equal(accepted.organizationId, ids.org);
    assert.deepEqual((await pg.query("SELECT organization_id, member_id, role_id FROM member_roles WHERE member_id = $1", [accepted.memberId])).rows,
      [{ organization_id: ids.org, member_id: accepted.memberId, role_id: ids.role }]);
    assert.equal((await acceptInvitation(invite.input)).status, "already-accepted");
    assert.equal((await replaceMemberRolesWithOwnerGuard({ organizationId: ids.org, memberId: ids.member, roleIds: [managerRole] })).allowed, true);
    assert.equal((await updateMemberStatusWithOwnerGuard({ organizationId: ids.org, memberId: accepted.memberId, status: "inactive" })).allowed, false);
  });

  await t.test("legacy foreign-role invitations still fail the application check", async () => {
    const invite = await invitation(ids.foreignRole);
    assert.equal((await acceptInvitation(invite.input)).status, "role-invalid");
    assert.equal((await pg.query("SELECT id FROM organization_members WHERE user_id = $1", [invite.input.userId])).rows.length, 0);
  });

  await t.test("failed role assignment rolls back invitation acceptance and membership", async () => {
    const invite = await invitation(managerRole);
    await pg.exec(`CREATE FUNCTION reject_test_assignment() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'assignment failure'; END; $$;
      CREATE TRIGGER reject_test_assignment BEFORE INSERT ON member_roles FOR EACH ROW EXECUTE FUNCTION reject_test_assignment();`);
    await assert.rejects(acceptInvitation(invite.input), /assignment failure/);
    assert.equal((await pg.query("SELECT id FROM organization_members WHERE user_id = $1", [invite.input.userId])).rows.length, 0);
    assert.deepEqual((await pg.query("SELECT accepted_at FROM organization_invitations WHERE id = $1", [invite.invitationId])).rows, [{ accepted_at: null }]);
    await pg.exec("DROP TRIGGER reject_test_assignment ON member_roles; DROP FUNCTION reject_test_assignment();");
    assert.equal((await acceptInvitation(invite.input)).status, "accepted");
  });
});
