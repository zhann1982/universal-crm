import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/unused";

test("pipeline management executes atomic production SQL in PostgreSQL", async t => {
  const pg = new PGlite();
  t.after(() => pg.close());
  for (const name of (await readdir("drizzle")).filter(n => n.endsWith(".sql")).sort()) await pg.exec(await readFile(`drizzle/${name}`, "utf8"));
  const { sql } = await import("@/db");
  const { managePipeline } = await import("./manage-pipeline");
  type Statement = { query: string; params: unknown[] };
  t.mock.method(sql, "transaction", async (build: (tx: { query: (query: string, params: unknown[]) => Statement }) => Statement[]) => {
    const statements = build({ query: (query, params) => ({ query, params }) });
    assert.match(statements[0].query, /pg_advisory_xact_lock/);
    assert.match(statements[1].query, /FOR UPDATE/);
    return pg.transaction(async tx => {
      const results = [];
      for (const s of statements) results.push((await tx.query(s.query, s.params)).rows);
      return results;
    });
  });
  const org = randomUUID(), foreign = randomUUID();
  for (const id of [org,foreign]) await pg.query("INSERT INTO organizations(id,name,slug) VALUES($1,'Test',$1::uuid::text)",[id]);
  const a = (await managePipeline(org,{operation:"create",name:"A"}))!;
  const b = (await managePipeline(org,{operation:"create",name:"B"}))!;
  const state = async (id: string) => (await pg.query<{version:number;is_default:boolean;is_archived:boolean}>("SELECT version,is_default,is_archived FROM pipelines WHERE id=$1",[id])).rows[0];
  await t.test("creation includes shared stages and one default", async () => {
    assert.equal((await pg.query("SELECT id FROM pipeline_stages WHERE pipeline_id=$1",[a])).rows.length,6);
    assert.equal((await state(a)).is_default,true);
    assert.equal((await state(b)).is_default,false);
  });
  await t.test("tenant scope and stale versions cannot write", async () => {
    assert.equal(await managePipeline(foreign,{operation:"edit",pipelineId:a,version:1,name:"Foreign"}),null);
    assert.equal(await managePipeline(org,{operation:"edit",pipelineId:a,version:1,name:"Edited"}),a);
    assert.equal(await managePipeline(org,{operation:"edit",pipelineId:a,version:1,name:"Stale"}),null);
    assert.equal((await state(a)).version,2);
  });
  await t.test("default switch and lifecycle guards", async () => {
    assert.equal(await managePipeline(org,{operation:"archive",pipelineId:a,version:2}),null);
    assert.equal(await managePipeline(org,{operation:"default",pipelineId:b,version:1}),b);
    assert.equal((await state(a)).is_default,false);
    assert.equal((await state(b)).is_default,true);
    assert.equal(await managePipeline(org,{operation:"archive",pipelineId:a,version:3}),a);
    assert.equal(await managePipeline(org,{operation:"stage",pipelineId:a,version:4,name:"Blocked",type:"open",probability:0,position:100}),null);
    assert.equal(await managePipeline(org,{operation:"restore",pipelineId:a,version:4}),a);
  });
  const stage = (await pg.query<{id:string}>("SELECT id FROM pipeline_stages WHERE pipeline_id=$1 AND position=10",[a])).rows[0].id;
  const deal = randomUUID();
  await pg.query("INSERT INTO deals(id,organization_id,pipeline_id,stage_id,title) VALUES($1,$2,$3,$4,'Deal')",[deal,org,a,stage]);
  await t.test("used stage type and active deal prevent destructive configuration", async () => {
    assert.equal(await managePipeline(org,{operation:"archive",pipelineId:a,version:5}),null);
    assert.equal(await managePipeline(org,{operation:"stage",pipelineId:a,version:5,stageId:stage,name:"Won",type:"won",probability:100,position:10}),null);
    assert.equal(await managePipeline(org,{operation:"stage",pipelineId:a,version:5,stageId:stage,name:"Renamed",type:"open",probability:30,position:11,color:"#00aabb"}),a);
  });
  await t.test("duplicate stage order rolls back the parent version", async () => {
    await assert.rejects(managePipeline(org,{operation:"stage",pipelineId:a,version:6,name:"Duplicate",type:"open",probability:1,position:20}));
    assert.equal((await state(a)).version,6);
  });
  await t.test("foreign stage cannot be reassigned through upsert", async () => {
    const other = (await managePipeline(foreign,{operation:"create",name:"Foreign"}))!;
    const s = (await pg.query<{id:string}>("SELECT id FROM pipeline_stages WHERE pipeline_id=$1 LIMIT 1",[other])).rows[0].id;
    assert.equal(await managePipeline(org,{operation:"stage",pipelineId:a,version:6,stageId:s,name:"Hijacked",type:"open",probability:0,position:99}),null);
  });
  await t.test("deal trigger rejects stale stage semantics and archived pipeline restore", async () => {
    const won = (await pg.query<{id:string}>("SELECT id FROM pipeline_stages WHERE pipeline_id=$1 AND type='won'",[a])).rows[0].id;
    await assert.rejects(pg.query("UPDATE deals SET stage_id=$1 WHERE id=$2",[won,deal]));
    await pg.query("UPDATE deals SET is_archived=true WHERE id=$1",[deal]);
    assert.equal(await managePipeline(org,{operation:"archive",pipelineId:a,version:6}),a);
    await assert.rejects(pg.query("UPDATE deals SET is_archived=false WHERE id=$1",[deal]));
  });
  await t.test("restored configuration accepts new stages and valid Deal state transitions", async () => {
    assert.equal(await managePipeline(org,{operation:"restore",pipelineId:a,version:7}),a);
    assert.equal(await managePipeline(org,{operation:"stage",pipelineId:a,version:8,name:"Extra",type:"open",probability:20,position:100,color:"#112233"}),a);
    await pg.query("UPDATE deals SET is_archived=false WHERE id=$1",[deal]);
    const won = (await pg.query<{id:string}>("SELECT id FROM pipeline_stages WHERE pipeline_id=$1 AND type='won'",[a])).rows[0].id;
    await pg.query("UPDATE deals SET stage_id=$1,closed_at=now() WHERE id=$2",[won,deal]);
    await pg.query("UPDATE deals SET stage_id=$1,closed_at=NULL WHERE id=$2",[stage,deal]);
    assert.equal((await pg.query<{color:string}>("SELECT name,color FROM pipeline_stages WHERE pipeline_id=$1 AND position=100",[a])).rows[0].color,"#112233");
  });
});
