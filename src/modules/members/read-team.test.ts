import assert from "node:assert/strict";
import test from "node:test";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/unused";
test("Team reads do not query Role configuration through Member visibility", async (t) => {
  const { sql } = await import("@/db");
  const { readTeamRows, readTeamRoleOptions } = await import("./read-team");
  const org = "00000000-0000-4000-8000-000000000001";
  for (const permissions of [
    [],
    ["members.read"],
    ["members.read", "roles.read"],
    ["members.read", "members.manage"],
  ])
    await t.test(permissions.join(",") || "none", async (s) => {
      const queries: { text: string; params: unknown[] }[] = [];
      s.mock.method(sql, "query", async (text: string, params: unknown[]) => {
        queries.push({ text, params });
        return { rows: [] };
      });
      const set = new Set(permissions);
      await readTeamRows(org, set);
      await readTeamRoleOptions(org, set);
      assert.equal(
        queries.length,
        Number(set.has("members.read")) + Number(set.has("members.manage")),
      );
      for (const q of queries) {
        assert.ok(q.params.includes(org));
        assert.ok(!q.text.includes('"roles"."description"'));
        if (q.text.includes('from "organization_members"'))
          assert.equal(
            q.text.includes('join "roles"'),
            set.has("roles.read") || set.has("members.manage"),
          );
      }
    });
});
