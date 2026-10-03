import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { getActivityActor, recordMutation } from "./mutation-context";

process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/unused";

test("business history is atomic with actual PostgreSQL writes and isolates tenants", async t => {
  const pg = new PGlite();
  t.after(() => pg.close());
  for (const file of (await readdir("drizzle")).filter(n => n.endsWith(".sql")).sort()) {
    await pg.exec(await readFile(`drizzle/${file}`, "utf8"));
  }
  const { db, sql } = await import("@/db");
  const { clients, companies, deals } = await import("@/db/schema");
  const { transitionDeal } = await import("@/modules/deals/transition-deal");
  const { readTimelineRows } = await import("./read-timeline");
  type Options = { arrayMode?: boolean; fullResults?: boolean };
  type Statement = { query: string; params: unknown[] };
  function shape(result: Awaited<ReturnType<typeof pg.query>>, options: Options = {}) {
    const rows = options.arrayMode
      ? result.rows.map(row => result.fields.map(field => (row as Record<string, unknown>)[field.name]))
      : result.rows;
    return options.fullResults ? { ...result, rows } : rows;
  }
  t.mock.method(sql, "query", async (query: string, params: unknown[], options: Options) =>
    shape(await pg.query<Record<string, unknown>>(query, params), options));
  t.mock.method(sql, "transaction", async (
    build: (tx: { query: (query: string, params: unknown[]) => Statement }) => Statement[], options: Options,
  ) => {
    const statements = build({ query: (query, params) => ({ query, params }) });
    assert.match(statements[0].query, /set_config/);
    return pg.transaction(async tx => {
      const results = [];
      for (const statement of statements) results.push(shape(await tx.query(statement.query, statement.params), options));
      return results;
    });
  });
  const org = randomUUID(), foreign = randomUUID(), member = randomUUID(), foreignMember = randomUUID();
  for (const id of [org, foreign]) await pg.query<Record<string, unknown>>("INSERT INTO organizations(id,name,slug) VALUES($1,'Test',$1::uuid::text)", [id]);
  for (const [id, scope] of [[member, org], [foreignMember, foreign]]) await pg.query<Record<string, unknown>>(
    "INSERT INTO organization_members(id,organization_id,user_id,display_name) VALUES($1,$2,$1::uuid::text,'Actor')", [id, scope]);
  const pipeline = randomUUID(), open = randomUUID(), won = randomUUID();
  await pg.query<Record<string, unknown>>("INSERT INTO pipelines(id,organization_id,name) VALUES($1,$2,'Pipeline')", [pipeline, org]);
  for (const [id, type, position] of [[open, "open", 0], [won, "won", 1]]) await pg.query<Record<string, unknown>>(
    "INSERT INTO pipeline_stages(id,organization_id,pipeline_id,name,type,position) VALUES($1,$2,$3,$4,$4,$5)", [id, org, pipeline, type, position]);
  const actor = { organizationId: org, memberId: member };
  const client = randomUUID(), company = randomUUID(), deal = randomUUID();
  const events = async (id: string) => (await pg.query<{ event_type: string; summary: string; details: string | null }>(
    "SELECT event_type,summary,details FROM activity_events WHERE entity_id=$1 ORDER BY created_at,id", [id])).rows;

  await t.test("creates all three entities with server actor and preserves RETURNING mappings", async () => {
    const rows = await recordMutation(actor, () => db.insert(clients).values({ id: client, organizationId: org, firstName: "Private name" }).returning({ id: clients.id }));
    assert.deepEqual(rows, [{ id: client }]);
    await recordMutation(actor, () => db.insert(companies).values({ id: company, organizationId: org, name: "Private company" }));
    await recordMutation(actor, () => db.insert(deals).values({ id: deal, organizationId: org, pipelineId: pipeline, stageId: open, title: "Private deal" }));
    for (const [id, type] of [[client, "client"], [company, "company"], [deal, "deal"]]) {
      assert.equal((await events(id))[0].event_type, `${type}.created`);
      assert.equal((await pg.query<Record<string, unknown>>("SELECT actor_member_id FROM activity_events WHERE entity_id=$1", [id])).rows[0].actor_member_id, member);
    }
    assert.equal(getActivityActor(), undefined);
  });
  await t.test("actual changed fields produce safe labels; no-op and unmatched updates produce nothing", async () => {
    await recordMutation(actor, () => db.update(clients).set({ email: "secret@example.test", notes: "Private notes", updatedAt: new Date() }).where(eq(clients.id, client)));
    const history = await events(client);
    assert.equal(history.length, 3);
    assert.ok(history.some(row => row.event_type === "client.email_changed"));
    assert.doesNotMatch(JSON.stringify(history), /secret|Private/);
    await recordMutation(actor, () => db.update(clients).set({ email: "secret@example.test", updatedAt: new Date() }).where(eq(clients.id, client)));
    await recordMutation(actor, () => db.update(clients).set({ firstName: "Absent" }).where(eq(clients.id, randomUUID())));
    assert.equal((await events(client)).length, 3);
  });
  await t.test("shared Deal transition records once; stale version and same stage add no events", async () => {
    const input = { organizationId: org, actorMemberId: member, dealId: deal, targetStageId: won, expectedVersion: 1 };
    assert.equal((await transitionDeal(input)).success, true);
    assert.equal((await events(deal)).filter(row => row.event_type === "deal.stage_id_changed").length, 1);
    const row = (await pg.query<Record<string, unknown>>("SELECT version,closed_at FROM deals WHERE id=$1", [deal])).rows[0];
    assert.equal(row.version, 2); assert.ok(row.closed_at);
    assert.equal((await transitionDeal(input)).success, false);
    assert.equal((await transitionDeal({ ...input, expectedVersion: 2 })).success, true);
    assert.equal((await events(deal)).length, 2);
  });
  await t.test("archive and restore use lifecycle events for each entity", async () => {
    for (const [table, id, type] of [[clients, client, "client"], [companies, company, "company"], [deals, deal, "deal"]] as const) {
      for (const isArchived of [true, false]) await recordMutation(actor, () => db.update(table).set({ isArchived }).where(eq(table.id, id)));
      const types = (await events(id)).map(row => row.event_type);
      assert.ok(types.includes(`${type}.archived`)); assert.ok(types.includes(`${type}.restored`));
    }
  });
  await t.test("foreign actor, wrong organization and inactive access roll back business writes", async () => {
    for (const invalid of [{ ...actor, memberId: foreignMember }, { ...actor, organizationId: foreign }]) {
      await assert.rejects(recordMutation(invalid, () => db.update(clients).set({ firstName: "Rejected" }).where(eq(clients.id, client))));
    }
    await pg.query<Record<string, unknown>>("UPDATE organization_members SET status='inactive' WHERE id=$1", [member]);
    await assert.rejects(recordMutation(actor, () => db.update(clients).set({ firstName: "Rejected" }).where(eq(clients.id, client))));
    await pg.query<Record<string, unknown>>("UPDATE organization_members SET status='active' WHERE id=$1", [member]);
    await pg.query<Record<string, unknown>>("UPDATE organizations SET is_active=false WHERE id=$1", [org]);
    await assert.rejects(recordMutation(actor, () => db.update(clients).set({ firstName: "Rejected" }).where(eq(clients.id, client))));
    await pg.query<Record<string, unknown>>("UPDATE organizations SET is_active=true WHERE id=$1", [org]);
    assert.equal((await pg.query<Record<string, unknown>>("SELECT first_name FROM clients WHERE id=$1", [client])).rows[0].first_name, "Private name");
  });
  await t.test("event insertion failure rolls back update and create, including Deal version", async () => {
    await pg.exec("CREATE FUNCTION fail_activity() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'history unavailable'; END; $$; CREATE TRIGGER fail_activity BEFORE INSERT ON activity_events FOR EACH ROW EXECUTE FUNCTION fail_activity();");
    const before = await events(client);
    await assert.rejects(recordMutation(actor, () => db.update(clients).set({ firstName: "Rejected" }).where(eq(clients.id, client))));
    await assert.rejects(recordMutation(actor, () => db.insert(companies).values({ organizationId: org, name: "Rejected" })));
    await assert.rejects(transitionDeal({ organizationId: org, actorMemberId: member, dealId: deal, targetStageId: open, expectedVersion: 2 }));
    assert.equal((await pg.query<Record<string, unknown>>("SELECT version,stage_id FROM deals WHERE id=$1", [deal])).rows[0].version, 2);
    assert.equal((await pg.query<Record<string, unknown>>("SELECT count(*)::int AS n FROM companies WHERE name='Rejected'")).rows[0].n, 0);
    assert.deepEqual(await events(client), before);
    await pg.exec("DROP TRIGGER fail_activity ON activity_events; DROP FUNCTION fail_activity();");
  });
  await t.test("context is transaction-local; maintenance writes do not impersonate last actor", async () => {
    const before = await events(client);
    await db.update(clients).set({ firstName: "Maintenance" }).where(eq(clients.id, client));
    assert.deepEqual(await events(client), before);
    assert.equal(getActivityActor(), undefined);
  });
  await t.test("timeline requires entity access and never includes hidden comments or member names", async () => {
    await pg.query<Record<string, unknown>>("INSERT INTO activity_events(organization_id,entity_type,entity_id,event_type,summary,details) VALUES($1,'client',$2,'comment.created','Hidden','Private body')", [org, client]);
    assert.equal((await readTimelineRows({ organizationId: org, entityId: client, entityType: "client", permissions: new Set(["activity.read"]) })).eventRows.length, 0);
    const visible = await readTimelineRows({ organizationId: org, entityId: client, entityType: "client", permissions: new Set(["clients.read", "activity.read"]) });
    assert.ok(visible.eventRows.length > 0);
    assert.ok(visible.eventRows.every(row => row.actorDisplayName === null && !row.eventType.startsWith("comment.")));
    assert.doesNotMatch(JSON.stringify(visible), /Private body|Actor/);
    assert.equal((await readTimelineRows({ organizationId: foreign, entityId: client, entityType: "client", permissions: new Set(["clients.read", "activity.read"]) })).eventRows.length, 0);
  });
});

test("concurrent async scopes keep independent actors and clear after errors", async () => {
  const actors = [1, 2].map(() => ({ organizationId: randomUUID(), memberId: randomUUID() }));
  await Promise.all(actors.map(actor => recordMutation(actor, async () => {
    await new Promise(resolve => setTimeout(resolve, 5));
    assert.deepEqual(getActivityActor(), actor);
  })));
  await assert.rejects(recordMutation(actors[0], async () => { throw new Error("failed"); }));
  assert.equal(getActivityActor(), undefined);
});
