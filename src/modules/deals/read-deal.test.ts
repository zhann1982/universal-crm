import assert from "node:assert/strict";
import test from "node:test";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/unused";

test("Deal detail only queries related names with their read permissions", async (t) => {
  const { sql } = await import("@/db");
  const { readDealDetails } = await import("./read-deal");
  const organizationId = "00000000-0000-4000-8000-000000000001";
  const memberId = "00000000-0000-4000-8000-000000000002";
  const dealId = "00000000-0000-4000-8000-000000000003";
  for (const related of [
    [],
    ["companies.read"],
    ["members.read"],
    ["companies.read", "members.read"],
  ]) {
    await t.test(
      `related permissions ${related.join(",") || "none"}`,
      async (s) => {
        const queries: { text: string; params: unknown[] }[] = [];
        s.mock.method(sql, "query", async (text: string, params: unknown[]) => {
          queries.push({ text, params });
          return { rows: [] };
        });
        await readDealDetails(dealId, {
          organizationId,
          memberId,
          memberDisplayName: "Self",
          permissions: new Set(["deals.read", "pipelines.read", ...related]),
        });
        assert.equal(queries.length, 1);
        const q = queries[0];
        assert.equal(
          q.text.includes("SELECT name FROM companies"),
          related.includes("companies.read"),
        );
        assert.equal(
          q.text.includes("SELECT display_name FROM organization_members"),
          related.includes("members.read"),
        );
        assert.ok(q.params.includes(organizationId));
        assert.ok(q.params.includes(dealId));
        if (!related.includes("members.read")) {
          assert.ok(q.params.includes(memberId));
          assert.ok(q.params.includes("Self"));
        }
      },
    );
  }
  await t.test(
    "entity and Pipeline read are both required before any query",
    async (s) => {
      s.mock.method(sql, "query", () => {
        throw new Error("unauthorized query");
      });
      for (const permissions of [
        ["deals.read"],
        ["pipelines.read"],
        ["companies.read", "members.read"],
      ])
        assert.equal(
          await readDealDetails(dealId, {
            organizationId,
            memberId,
            memberDisplayName: null,
            permissions: new Set(permissions),
          }),
          null,
        );
    },
  );
});
