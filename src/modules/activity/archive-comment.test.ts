import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/unused";

test("comment lifecycle writes lock a writable tenant parent and atomically record the event", async (t) => {
  const { sql } = await import("@/db");
  const { setCommentArchived } = await import("./archive-comment");
  for (const entityType of ["client", "company", "deal", "task"] as const) {
    for (const archive of [true, false]) {
      await t.test(`${entityType} ${archive ? "archive" : "restore"}`, async (context) => {
        const input = {
          organizationId: "00000000-0000-4000-8000-000000000001",
          entityId: "00000000-0000-4000-8000-000000000002",
          commentId: "00000000-0000-4000-8000-000000000003",
          actorMemberId: "00000000-0000-4000-8000-000000000004",
          entityType, archive, expectedVersion: 7,
        };
        let changed = false;
        context.mock.method(sql, "query", async (query: string, params: unknown[]) => {
          assert.match(query, /is_archived = false AND deleted_at IS NULL\s+FOR UPDATE/);
          assert.match(query, /comments.entity_id = writable_target.id/);
          assert.match(query, /comments.organization_id = \$2::uuid/);
          assert.match(query, /comments.version = \$6/);
          assert.match(query, /INSERT INTO activity_events/);
          assert.match(query, /FROM changed_comment\s+RETURNING id/);
          assert.deepEqual(params.slice(0, 6), [input.entityId, input.organizationId, archive, input.commentId, entityType, 7]);
          assert.equal(params[8], archive ? "comment.archived" : "comment.restored");
          return changed ? [{ id: "event-id" }] : [];
        });
        assert.equal(await setCommentArchived(input), false, "no changed row is not success");
        changed = true;
        assert.equal(await setCommentArchived(input), true);
      });
    }
  }
});
