import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/unused";

test("comment persistence checks parent lifecycle and commits history atomically in PostgreSQL", async (t) => {
  const pg = new PGlite();
  t.after(() => pg.close());
  for (const name of (await readdir("drizzle")).filter((name) => name.endsWith(".sql")).sort()) {
    await pg.exec(await readFile(`drizzle/${name}`, "utf8"));
  }
  const { sql } = await import("@/db");
  const { saveComment } = await import("./save-comment");
  const { setCommentArchived } = await import("./archive-comment");
  t.mock.method(sql, "query", async (query: string, params: unknown[]) => {
    assert.match(query, /FOR UPDATE/);
    return (await pg.query(query, params)).rows;
  });
  const organizationId = randomUUID();
  const foreignOrg = randomUUID();
  const actorMemberId = randomUUID();
  const otherMember = randomUUID();
  for (const org of [organizationId, foreignOrg]) {
    await pg.query("INSERT INTO organizations (id, name, slug) VALUES ($1, 'Test', $2)", [org, org]);
  }
  for (const member of [actorMemberId, otherMember]) {
    await pg.query("INSERT INTO organization_members (id, organization_id, user_id) VALUES ($1, $2, $3)", [member, organizationId, member]);
  }
  const pipelineId = randomUUID();
  const stageId = randomUUID();
  await pg.query("INSERT INTO pipelines (id, organization_id, name) VALUES ($1, $2, 'Main')", [pipelineId, organizationId]);
  await pg.query("INSERT INTO pipeline_stages (id, organization_id, pipeline_id, name, position) VALUES ($1, $2, $3, 'Open', 0)", [stageId, organizationId, pipelineId]);
  const tables = { client: "clients", company: "companies", deal: "deals", task: "tasks" } as const;
  async function counts() {
    return (await pg.query("SELECT (SELECT count(*) FROM comments) AS comments, (SELECT count(*) FROM activity_events) AS events")).rows;
  }
  async function snapshot(id: string) {
    return (await pg.query("SELECT body, version, is_archived, updated_at FROM comments WHERE id = $1", [id])).rows;
  }

  for (const entityType of ["client", "company", "deal", "task"] as const) {
    const entityId = randomUUID();
    const otherParent = randomUUID();
    for (const id of [entityId, otherParent]) {
      if (entityType === "client") await pg.query("INSERT INTO clients (id, organization_id, first_name) VALUES ($1, $2, 'Test')", [id, organizationId]);
      if (entityType === "company") await pg.query("INSERT INTO companies (id, organization_id, name) VALUES ($1, $2, 'Test')", [id, organizationId]);
      if (entityType === "deal") await pg.query("INSERT INTO deals (id, organization_id, pipeline_id, stage_id, title) VALUES ($1, $2, $3, $4, 'Test')", [id, organizationId, pipelineId, stageId]);
      if (entityType === "task") await pg.query("INSERT INTO tasks (id, organization_id, title) VALUES ($1, $2, 'Test')", [id, organizationId]);
    }
    const commentId = randomUUID();
    const input = { organizationId, entityType, entityId, commentId, actorMemberId,
      body: "O'Brien: комментарий $1", expectedVersion: null as number | null, canManage: false };

    await t.test(`${entityType}: creation and editing persist matching history`, async () => {
      assert.equal(await saveComment(input), true);
      assert.deepEqual((await pg.query("SELECT body, version, author_member_id FROM comments WHERE id = $1", [commentId])).rows,
        [{ body: input.body, version: 1, author_member_id: actorMemberId }]);
      assert.deepEqual((await pg.query("SELECT entity_type, entity_id, details, event_type FROM activity_events WHERE comment_id = $1", [commentId])).rows,
        [{ entity_type: entityType, entity_id: entityId, details: input.body, event_type: "comment.created" }]);
      assert.equal(await saveComment({ ...input, expectedVersion: 1, body: "Edited" }), true);
      assert.deepEqual((await pg.query("SELECT body, version FROM comments WHERE id = $1", [commentId])).rows, [{ body: "Edited", version: 2 }]);
    });

    await t.test(`${entityType}: stale version, tenant, parent and entity type mismatches do not write`, async () => {
      const before = await counts();
      const state = await snapshot(commentId);
      for (const change of [
        { expectedVersion: 1 }, { organizationId: foreignOrg }, { entityId: otherParent },
        { entityId: randomUUID() }, { entityType: entityType === "task" ? "client" as const : "task" as const },
      ]) assert.equal(await saveComment({ ...input, expectedVersion: 2, ...change }), false);
      assert.equal(await saveComment({ ...input, commentId: randomUUID(), organizationId: foreignOrg }), false);
      assert.deepEqual(await snapshot(commentId), state);
      assert.deepEqual(await counts(), before);
    });

    await t.test(`${entityType}: another author requires server-granted manage permission`, async () => {
      const before = await counts();
      assert.equal(await saveComment({ ...input, actorMemberId: otherMember, expectedVersion: 2 }), false);
      assert.deepEqual(await counts(), before);
      assert.equal(await saveComment({ ...input, actorMemberId: otherMember, expectedVersion: 2, canManage: true }), true);
      assert.deepEqual((await pg.query("SELECT author_member_id, version FROM comments WHERE id = $1", [commentId])).rows, [{ author_member_id: actorMemberId, version: 3 }]);
    });

    await t.test(`${entityType}: archived or deleted parent blocks all comment writes after earlier checks`, async () => {
      for (const lifecycle of ["is_archived = true", "deleted_at = now()"] as const) {
        await pg.query(`UPDATE ${tables[entityType]} SET ${lifecycle} WHERE id = $1`, [entityId]);
        const before = await counts();
        const state = await snapshot(commentId);
        assert.equal(await saveComment({ ...input, commentId: randomUUID() }), false);
        assert.equal(await saveComment({ ...input, expectedVersion: 3 }), false);
        assert.equal(await setCommentArchived({ ...input, expectedVersion: 3, archive: true }), false);
        assert.deepEqual(await snapshot(commentId), state);
        assert.deepEqual(await counts(), before);
        await pg.query(`UPDATE ${tables[entityType]} SET is_archived = false, deleted_at = NULL WHERE id = $1`, [entityId]);
      }
    });

    await t.test(`${entityType}: archived comments reject editing and can be restored on an active parent`, async () => {
      assert.equal(await setCommentArchived({ ...input, expectedVersion: 3, archive: true }), true);
      const before = await counts();
      assert.equal(await saveComment({ ...input, expectedVersion: 4 }), false);
      await pg.query(`UPDATE ${tables[entityType]} SET is_archived = true WHERE id = $1`, [entityId]);
      assert.equal(await setCommentArchived({ ...input, expectedVersion: 4, archive: false }), false);
      assert.deepEqual(await counts(), before);
      await pg.query(`UPDATE ${tables[entityType]} SET is_archived = false WHERE id = $1`, [entityId]);
      assert.equal(await setCommentArchived({ ...input, expectedVersion: 4, archive: false }), true);
      assert.equal(await saveComment({ ...input, expectedVersion: 5 }), true);
    });

    await t.test(`${entityType}: event failure rolls back creation, editing and archive`, async () => {
      await pg.exec(`CREATE FUNCTION reject_comment_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'comment event failure'; END; $$;
        CREATE TRIGGER reject_comment_event BEFORE INSERT ON activity_events FOR EACH ROW EXECUTE FUNCTION reject_comment_event();`);
      const before = await counts();
      const state = await snapshot(commentId);
      await assert.rejects(saveComment({ ...input, commentId: randomUUID() }), /comment event failure/);
      await assert.rejects(saveComment({ ...input, expectedVersion: 6, body: "Must roll back" }), /comment event failure/);
      await assert.rejects(setCommentArchived({ ...input, expectedVersion: 6, archive: true }), /comment event failure/);
      assert.deepEqual(await snapshot(commentId), state);
      assert.deepEqual(await counts(), before);
      await pg.exec("DROP TRIGGER reject_comment_event ON activity_events; DROP FUNCTION reject_comment_event();");
    });

    await t.test(`${entityType}: soft-deleted comments reject edit and archive`, async () => {
      await pg.query("UPDATE comments SET deleted_at = now() WHERE id = $1", [commentId]);
      const before = await counts();
      assert.equal(await saveComment({ ...input, expectedVersion: 6 }), false);
      assert.equal(await setCommentArchived({ ...input, expectedVersion: 6, archive: true }), false);
      assert.deepEqual(await counts(), before);
    });
  }
  await t.test("unsupported identifiers cannot enter dynamic SQL", async () => {
    const { writableCommentTargetSql } = await import("./comment-target");
    for (const value of ["__proto__", "constructor", "tasks; DROP TABLE comments"]) {
      assert.throws(() => writableCommentTargetSql(value as "task"), /Unsupported comment entity type/);
    }
  });
});
