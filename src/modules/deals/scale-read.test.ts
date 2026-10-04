import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { isolatedPostgres } from "@/test/isolated-postgres";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/unused";
test("bounded CRM reads page representative data without duplicates, missing rows or hidden references", async (t) => {
  const pg = await isolatedPostgres(t);
  const { readBoardColumn, readBoardSummary } = await import("./read-board");
  const { readTimelineRows } = await import("@/modules/activity/read-timeline");
  const { readReferenceOptions } =
    await import("@/modules/references/read-options");
  const org = randomUUID(),
    member = randomUUID(),
    pipeline = randomUUID(),
    stage = randomUUID(),
    client = randomUUID(),
    foreign = randomUUID();
  for (const id of [org, foreign])
    await pg.query(
      "INSERT INTO organizations(id,name,slug)VALUES($1,'Test',$1::uuid::text)",
      [id],
    );
  await pg.query(
    "INSERT INTO organization_members(id,organization_id,user_id,display_name)VALUES($1,$2,$1::uuid::text,'Self')",
    [member, org],
  );
  await pg.query(
    "INSERT INTO pipelines(id,organization_id,name)VALUES($1,$2,'Test')",
    [pipeline, org],
  );
  await pg.query(
    "INSERT INTO pipeline_stages(id,organization_id,pipeline_id,name,position)VALUES($1,$2,$3,'Open',0)",
    [stage, org, pipeline],
  );
  await pg.query(
    "INSERT INTO clients(id,organization_id,first_name)VALUES($1,$2,'Timeline target')",
    [client, org],
  );
  await pg.query(
    "INSERT INTO deals(id,organization_id,pipeline_id,stage_id,title,amount,currency,created_at) SELECT overlay(overlay(md5('deal'||n) placing '4' from 13 for 1) placing '8' from 17 for 1)::uuid,$1,$2,$3,'Deal '||n,10,CASE WHEN n%2=0 THEN 'USD' ELSE 'KZT' END,'2026-10-04T00:00:00Z'::timestamptz+(n%3)*interval '1 microsecond' FROM generate_series(1,4000)n",
    [org, pipeline, stage],
  );
  await pg.query(
    "INSERT INTO clients(id,organization_id,first_name)SELECT overlay(overlay(md5('client'||n) placing '4' from 13 for 1) placing '8' from 17 for 1)::uuid,$1,'Search client '||n FROM generate_series(1,250)n",
    [org],
  );
  await pg.query(
    "INSERT INTO clients(organization_id,first_name)VALUES($1,'Foreign invisible')",
    [foreign],
  );
  await pg.query(
    "INSERT INTO activity_events(id,organization_id,entity_type,entity_id,event_type,summary,created_at) SELECT overlay(overlay(md5('event'||n) placing '4' from 13 for 1) placing '8' from 17 for 1)::uuid,$1,'client',$2,'client.updated','Changed','2026-10-04T00:00:00Z'::timestamptz+(n%3)*interval '1 microsecond' FROM generate_series(1,700)n",
    [org, client],
  );
  const context = {
    organizationId: org,
    memberId: member,
    memberDisplayName: "Self",
    permissions: new Set([
      "deals.read",
      "pipelines.read",
      "clients.read",
      "activity.read",
    ]),
  };
  const filters = {
    pipeline,
    q: "",
    owner: "all" as const,
    state: "all" as const,
    close: "all" as const,
  };
  await t.test(
    "4000 deals are reachable through bounded keyset pages including microsecond ties",
    async () => {
      const seen = new Set<string>();
      let cursor: { id: string; at: string } | undefined;
      do {
        const page = await readBoardColumn(context, filters, stage, cursor);
        assert.ok(page.rows.length <= 20);
        for (const row of page.rows) {
          assert.ok(!seen.has(row.id));
          seen.add(row.id);
          assert.equal(row.companyName, null);
        }
        cursor = page.next ?? undefined;
      } while (cursor);
      assert.equal(seen.size, 4000);
      const totals = await readBoardSummary(context, filters);
      assert.equal(
        totals.reduce((n, row) => n + row.count, 0),
        4000,
      );
      assert.deepEqual(
        totals.map((row) => [row.currency, Number(row.amount)]).sort(),
        [
          ["KZT", 20000],
          ["USD", 20000],
        ],
      );
    },
  );
  await t.test(
    "700 history events are reachable without duplicate rows or timestamp truncation",
    async () => {
      const seen = new Set<string>();
      let cursor: string | undefined;
      do {
        const page = await readTimelineRows({
          organizationId: org,
          entityType: "client",
          entityId: client,
          permissions: context.permissions,
          cursor,
        });
        assert.ok(page.eventRows.length <= 50);
        for (const row of page.eventRows) {
          assert.ok(!seen.has(row.id));
          seen.add(row.id);
        }
        cursor = page.nextCursor ?? undefined;
      } while (cursor);
      assert.equal(seen.size, 700);
    },
  );
  await t.test(
    "reference search is bounded and scopes permissions and organization",
    async () => {
      assert.equal(
        (await readReferenceOptions(context, "client", "Search")).length,
        50,
      );
      assert.equal(
        (await readReferenceOptions(context, "client", "Foreign")).length,
        0,
      );
      assert.deepEqual(await readReferenceOptions(context, "company", ""), []);
      assert.deepEqual(await readReferenceOptions(context, "member", ""), [
        { id: member, label: "Self" },
      ]);
      assert.equal(
        (
          await readReferenceOptions(
            { ...context, permissions: new Set() },
            "client",
            "",
          )
        ).length,
        0,
      );
    },
  );
});
