import assert from "node:assert/strict";
import test from "node:test";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

// No database connection is used: each test replaces both database entry points.
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/unused";

const organizationId = "00000000-0000-4000-8000-000000000001";
const dealId = "00000000-0000-4000-8000-000000000002";
const stageId = "00000000-0000-4000-8000-000000000003";
const targetStageId = "00000000-0000-4000-8000-000000000004";
const pipelineId = "00000000-0000-4000-8000-000000000005";

test("stage transitions enforce the page version and the conditional write", async (t) => {
  const { db } = await import("@/db");
  const { transitionDeal } = await import("./transition-deal");

  const scenarios = [
    { name: "stale board is rejected before target lookup", version: 8, expected: 7, target: targetStageId, rows: true, code: "conflict", reads: 1, writes: 0 },
    { name: "stale no-op is also a conflict", version: 8, expected: 7, target: stageId, rows: true, code: "conflict", reads: 1, writes: 0 },
    { name: "current version moves the deal", version: 7, expected: 7, target: targetStageId, rows: true, code: null, reads: 2, writes: 1 },
    { name: "change after lookup returns conflict", version: 7, expected: 7, target: targetStageId, rows: false, code: "conflict", reads: 2, writes: 1 },
    { name: "current no-op does not write", version: 7, expected: 7, target: stageId, rows: true, code: null, reads: 2, writes: 0 },
    { name: "missing page version cannot use the latest version", version: 7, expected: undefined, target: targetStageId, rows: true, code: "invalid-input", reads: 0, writes: 0 },
    { name: "invalid version is rejected", version: 7, expected: 0, target: targetStageId, rows: true, code: "invalid-input", reads: 0, writes: 0 },
  ];

  for (const scenario of scenarios) {
    await t.test(scenario.name, async (context) => {
      let reads = 0;
      let writes = 0;
      let predicate: SQL | undefined;
      let changes: Record<string, unknown> | undefined;
      context.mock.method(db, "select", () => {
        reads++;
        const rows = reads === 1
          ? [{ id: dealId, version: scenario.version, pipelineId, stageId, closedAt: null }]
          : [{ id: scenario.target, pipelineId, type: "won" }];
        return { from: () => ({ where: () => ({ limit: async () => rows }) }) };
      });
      context.mock.method(db, "update", () => {
        writes++;
        return { set: (values: Record<string, unknown>) => {
          changes = values;
          return { where: (condition: SQL) => {
            predicate = condition;
            return { returning: async () => scenario.rows
              ? [{ id: dealId, pipelineId, stageId: scenario.target, version: scenario.version + 1 }]
              : [] };
          } };
        } };
      });

      const result = await transitionDeal({
        organizationId, dealId, targetStageId: scenario.target,
        expectedVersion: scenario.expected as number,
      });
      assert.equal(result.success ? null : result.code, scenario.code);
      assert.equal(reads, scenario.reads);
      assert.equal(writes, scenario.writes);
      if (writes) {
        assert.equal(changes?.version, scenario.expected! + 1);
        assert.equal(changes?.stageId, targetStageId);
        assert.ok(changes?.closedAt instanceof Date);
        assert.ok(predicate);
        const query = new PgDialect().sqlToQuery(predicate);
        const match = query.sql.match(/"deals"\."version" = \$(\d+)/);
        assert.ok(match, "UPDATE must constrain the version, not just the id");
        assert.equal(query.params[Number(match[1]) - 1], scenario.expected);
      }
    });
  }
});
