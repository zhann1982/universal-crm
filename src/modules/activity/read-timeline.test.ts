import assert from "node:assert/strict";
import test from "node:test";

// Exercise the real Drizzle query builder, replacing only the network boundary.
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/unused";

test("timeline reads enforce independent content permissions in SQL", async (t) => {
  const { sql } = await import("@/db");
  const { readTimelineRows } = await import("./read-timeline");
  const base = {
    organizationId: "00000000-0000-4000-8000-000000000001",
    entityId: "00000000-0000-4000-8000-000000000002",
    entityType: "task" as const,
  };

  for (const scenario of [
    { name: "activity without comments excludes comment history", permissions: ["tasks.read", "activity.read"], events: true, comments: false, members: false },
    { name: "comments without activity never query events", permissions: ["tasks.read", "comments.read"], events: false, comments: true, members: false },
    { name: "both permissions include comment history", permissions: ["tasks.read", "activity.read", "comments.read", "members.read"], events: true, comments: true, members: true },
    { name: "creation permission grants no read access", permissions: ["tasks.read", "comments.create"], events: false, comments: false, members: false },
    { name: "entity access is required even with content permissions", permissions: ["activity.read", "comments.read", "members.read"], events: false, comments: false, members: false },
  ]) {
    await t.test(scenario.name, async (context) => {
      const queries: { text: string; params: unknown[] }[] = [];
      context.mock.method(sql, "query", async (text: string, params: unknown[]) => {
        queries.push({ text, params });
        return { rows: [] };
      });
      await readTimelineRows({ ...base, permissions: new Set(scenario.permissions) });
      assert.equal(queries.length, Number(scenario.events) + Number(scenario.comments));
      for (const query of queries) {
        const events = query.text.includes('from "activity_events"');
        assert.equal(events ? scenario.events : scenario.comments, true);
        for (const value of [base.organizationId, base.entityType, base.entityId]) {
          assert.ok(query.params.includes(value), "query must scope tenant, type and target");
        }
        assert.equal(query.text.includes('join "organization_members"'), scenario.members);
        assert.equal(query.text.includes('"organization_members"."display_name"'), scenario.members);
        if (events && !scenario.comments) {
          assert.match(query.text, /"comment_id" is null/);
          assert.match(query.text, /"event_type" not like/);
          assert.ok(query.params.includes("comment.%"), "null comment FK must not expose old bodies");
        }
        if (events && scenario.comments) assert.doesNotMatch(query.text, /not like/);
      }
    });
  }
});
