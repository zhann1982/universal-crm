import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("Task, Schedule, Comment and Activity tenant constraints protect direct PostgreSQL writes", async (t) => {
  const pg = new PGlite();
  t.after(() => pg.close());
  for (const f of (await readdir("drizzle"))
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await pg.exec(await readFile(`drizzle/${f}`, "utf8"));
  const a = randomUUID(),
    b = randomUUID(),
    ma = randomUUID(),
    mb = randomUUID(),
    ca = randomUUID(),
    cb = randomUUID(),
    ta = randomUUID(),
    tb = randomUUID();
  for (const [o, m, c, task] of [
    [a, ma, ca, ta],
    [b, mb, cb, tb],
  ]) {
    await pg.query(
      "INSERT INTO organizations(id,name,slug)VALUES($1,'Test',$1::uuid::text)",
      [o],
    );
    await pg.query(
      "INSERT INTO organization_members(id,organization_id,user_id)VALUES($1,$2,$1::uuid::text)",
      [m, o],
    );
    await pg.query(
      "INSERT INTO clients(id,organization_id,first_name)VALUES($1,$2,'Test')",
      [c, o],
    );
    await pg.query(
      "INSERT INTO tasks(id,organization_id,title,owner_member_id,created_by_member_id,client_id)VALUES($1,$2,'Test',$3,$3,$4)",
      [task, o, m, c],
    );
  }
  const rejects = async (q: string, p: unknown[], code = "23503") =>
    assert.rejects(
      pg.query(q, p),
      (e: unknown) => (e as { code: string }).code === code,
    );
  await t.test("Task relationships cannot cross tenants", async () => {
    for (const [column, id] of [
      ["owner_member_id", mb],
      ["created_by_member_id", mb],
      ["client_id", cb],
    ])
      await rejects(`UPDATE tasks SET ${column}=$1 WHERE id=$2`, [id, ta]);
    await rejects(
      "INSERT INTO task_schedules(organization_id,task_id) VALUES($1,$2)",
      [a, tb],
    );
    await pg.query(
      "INSERT INTO task_schedules(organization_id,task_id) VALUES($1,$2)",
      [a, ta],
    );
    await rejects(
      "UPDATE task_schedules SET organization_id=$1 WHERE task_id=$2",
      [b, ta],
    );
    await rejects("UPDATE task_schedules SET task_id=$1 WHERE task_id=$2", [
      tb,
      ta,
    ]);
  });
  await t.test("Comment target and author are tenant bound", async () => {
    await rejects(
      "INSERT INTO comments(organization_id,entity_type,entity_id,body)VALUES($1,'client',$2,'Test')",
      [a, cb],
    );
    await rejects(
      "INSERT INTO comments(organization_id,entity_type,entity_id,body,author_member_id)VALUES($1,'client',$2,'Test',$3)",
      [a, ca, mb],
    );
    await rejects(
      "INSERT INTO comments(organization_id,entity_type,entity_id,body)VALUES($1,'unknown',$2,'Test')",
      [a, ca],
      "23514",
    );
  });
  await t.test(
    "Activity target, actor and referenced Comment must match",
    async () => {
      const c = randomUUID();
      await pg.query(
        "INSERT INTO comments(id,organization_id,entity_type,entity_id,body)VALUES($1,$2,'client',$3,'Test')",
        [c, a, ca],
      );
      await rejects(
        "INSERT INTO activity_events(organization_id,entity_type,entity_id,event_type,summary)VALUES($1,'task',$2,'task.created','Test')",
        [a, tb],
      );
      await rejects(
        "INSERT INTO activity_events(organization_id,entity_type,entity_id,event_type,summary,actor_member_id)VALUES($1,'client',$2,'client.updated','Test',$3)",
        [a, ca, mb],
      );
      await rejects(
        "INSERT INTO activity_events(organization_id,entity_type,entity_id,event_type,summary,comment_id)VALUES($1,'task',$2,'comment.created','Test',$3)",
        [a, ta, c],
      );
      await pg.query(
        "INSERT INTO activity_events(organization_id,entity_type,entity_id,event_type,summary,comment_id)VALUES($1,'client',$2,'comment.created','Test',$3)",
        [a, ca, c],
      );
      await rejects("DELETE FROM clients WHERE id=$1", [ca]);
      await pg.query("DELETE FROM comments WHERE id=$1", [c]);
      assert.equal(
        (
          await pg.query<{ comment_id: string | null }>(
            "SELECT comment_id FROM activity_events WHERE entity_id=$1",
            [ca],
          )
        ).rows[0].comment_id,
        null,
      );
    },
  );
  await t.test(
    "inactive owner remains valid and deletion preserves SET NULL",
    async () => {
      await pg.query(
        "UPDATE organization_members SET status='inactive' WHERE id=$1",
        [ma],
      );
      await pg.query("UPDATE tasks SET title='Changed' WHERE id=$1", [ta]);
      await pg.query("DELETE FROM organization_members WHERE id=$1", [ma]);
      const row = (
        await pg.query<{ owner_member_id: string | null }>(
          "SELECT owner_member_id FROM tasks WHERE id=$1",
          [ta],
        )
      ).rows[0];
      assert.equal(row.owner_member_id, null);
    },
  );
  const audit = (
    await pg.query<{ violations: number }>(
      await readFile("src/db/integrity-audit.sql", "utf8"),
    )
  ).rows;
  assert.ok(audit.every((r) => r.violations === 0));
});
