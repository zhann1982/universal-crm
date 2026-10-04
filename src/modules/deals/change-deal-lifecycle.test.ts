import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { isolatedPostgres } from "@/test/isolated-postgres";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/unused";
test("Deal rendered-version lifecycle conflicts preserve newer changes and atomic history", async (t) => {
  const pg = await isolatedPostgres(t);
  const { changeDealLifecycle } = await import("./change-deal-lifecycle");
  const { transitionDeal } = await import("./transition-deal");
  const org = randomUUID(),
    member = randomUUID(),
    pipeline = randomUUID(),
    a = randomUUID(),
    b = randomUUID(),
    deal = randomUUID(),
    foreign = randomUUID();
  await pg.query(
    "INSERT INTO organizations(id,name,slug)VALUES($1,'Test',$1::uuid::text)",
    [org],
  );
  await pg.query(
    "INSERT INTO organization_members(id,organization_id,user_id)VALUES($1,$2,$1::uuid::text)",
    [member, org],
  );
  await pg.query(
    "INSERT INTO pipelines(id,organization_id,name)VALUES($1,$2,'Test')",
    [pipeline, org],
  );
  for (const [id, position] of [
    [a, 0],
    [b, 1],
  ])
    await pg.query(
      "INSERT INTO pipeline_stages(id,organization_id,pipeline_id,name,position)VALUES($1,$2,$3,$1::uuid::text,$4)",
      [id, org, pipeline, position],
    );
  await pg.query(
    "INSERT INTO deals(id,organization_id,pipeline_id,stage_id,title)VALUES($1,$2,$3,$4,'Original')",
    [deal, org, pipeline, a],
  );
  const input = {
    organizationId: org,
    memberId: member,
    dealId: deal,
    archive: true,
    expectedVersion: 1,
  };
  assert.equal(
    (
      await transitionDeal({
        organizationId: org,
        actorMemberId: member,
        dealId: deal,
        targetStageId: b,
        expectedVersion: 1,
      })
    ).success,
    true,
  );
  assert.equal(await changeDealLifecycle(input), null);
  assert.equal(
    (await changeDealLifecycle({ ...input, expectedVersion: 2 }))?.version,
    3,
  );
  assert.equal(
    await changeDealLifecycle({ ...input, archive: false, expectedVersion: 2 }),
    null,
  );
  assert.equal(
    (
      await changeDealLifecycle({
        ...input,
        archive: false,
        expectedVersion: 3,
      })
    )?.version,
    4,
  );
  assert.equal(
    await changeDealLifecycle({
      ...input,
      organizationId: foreign,
      expectedVersion: 4,
    }),
    null,
  );
  assert.equal(
    await changeDealLifecycle({ ...input, expectedVersion: 0 }),
    null,
  );
  assert.equal(
    (
      await pg.query("SELECT id FROM activity_events WHERE entity_id=$1", [
        deal,
      ])
    ).rows.length,
    3,
  );
  await pg.exec(
    "CREATE FUNCTION fail_history_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'history failure'; END $$; CREATE TRIGGER fail_history BEFORE INSERT ON activity_events FOR EACH ROW EXECUTE FUNCTION fail_history_test();",
  );
  await assert.rejects(changeDealLifecycle({ ...input, expectedVersion: 4 }));
  const state = (
    await pg.query<{ version: number; is_archived: boolean }>(
      "SELECT version,is_archived FROM deals WHERE id=$1",
      [deal],
    )
  ).rows[0];
  assert.deepEqual(state, { version: 4, is_archived: false });
});
