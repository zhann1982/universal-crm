import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { and, eq } from "drizzle-orm";
import { dealFilters, filtersHref, parseFilters } from "./filters";

process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/unused";

test("saved views and Deal filters preserve personal tenant boundaries in PostgreSQL", async t => {
  const pg = new PGlite(); t.after(()=>pg.close());
  for (const file of (await readdir("drizzle")).filter(n=>n.endsWith(".sql")).sort()) await pg.exec(await readFile(`drizzle/${file}`,"utf8"));
  const { sql } = await import("@/db");
  const { saveView, readViews } = await import("./persistence");
  type Statement = {query:string;params:unknown[]};
  t.mock.method(sql,"query",async (q:string,p:unknown[])=>(await pg.query(q,p)).rows);
  t.mock.method(sql,"transaction",async (build:(tx:{query:(q:string,p:unknown[])=>Statement})=>Statement[])=> {
    const statements=build({query:(query,params)=>({query,params})});
    assert.match(statements[0].query,/pg_advisory_xact_lock/);
    return pg.transaction(async tx=>{const result=[];for(const s of statements) result.push((await tx.query(s.query,s.params)).rows);return result;});
  });
  const org=randomUUID(), foreign=randomUUID(), self=randomUUID(), other=randomUUID(), foreignMember=randomUUID();
  for(const id of [org,foreign]) await pg.query("INSERT INTO organizations(id,name,slug) VALUES($1,'Test',$1::uuid::text)",[id]);
  for(const [id,o] of [[self,org],[other,org],[foreignMember,foreign]]) await pg.query("INSERT INTO organization_members(id,organization_id,user_id,display_name) VALUES($1,$2,$1::uuid::text,$1::uuid::text)",[id,o]);
  const id=randomUUID(); const draft={id,entity:"clients" as const,operation:"save" as const,name:"Active",filters:{q:" Alice ",status:"active",view:"active"}};
  await t.test("save normalizes allowlisted filters and reads only the owner",async()=>{
    assert.equal(await saveView(org,self,draft),true);
    assert.equal((await readViews(org,self,"clients")).length,1);
    assert.equal((await readViews(org,other,"clients")).length,0);
    assert.equal((await readViews(foreign,self,"clients")).length,0);
    assert.equal((await readViews(org,self,"companies")).length,0);
    assert.equal((await readViews(org,self,"clients"))[0].filters.q,"Alice");
  });
  await t.test("request replay and duplicate name never add records",async()=>{
    assert.equal(await saveView(org,self,draft),false);
    await assert.rejects(saveView(org,self,{...draft,id:randomUUID()}));
    assert.equal((await readViews(org,self,"clients")).length,1);
  });
  await t.test("archive checks identity, entity and rendered version",async()=>{
    for(const [o,m,entity,version] of [[foreign,self,"clients",1],[org,other,"clients",1],[org,self,"companies",1],[org,self,"clients",2]] as const)
      assert.equal(await saveView(o,m,{id,operation:"archive",entity,version}),false);
    assert.equal(await saveView(org,self,{id,entity:"clients",operation:"archive",version:1}),true);
    assert.equal(await saveView(org,self,{id,entity:"clients",operation:"restore",version:1}),false);
    assert.equal(await saveView(org,self,{id,entity:"clients",operation:"restore",version:2}),true);
  });
  await t.test("canonical filters reject arbitrary URLs, references and unsupported keys",async()=>{
    assert.throws(()=>parseFilters("clients",{q:"x",organizationId:foreign}));
    assert.throws(()=>parseFilters("companies",{status:"lead"}));
    assert.throws(()=>parseFilters("deals",{pipeline:"https://evil.example"}));
    assert.match(filtersHref("clients",{q:"a&view=archive"}),/^\/crm\/clients\?q=a%26view%3Darchive&view=active&status=all$/);
    await assert.rejects(saveView(org,self,{...draft,id:randomUUID(),filters:{page:99}}));
    await assert.rejects(saveView(org,foreignMember,{...draft,id:randomUUID(),name:"Bad member"}));
  });
  const pipe=randomUUID(), foreignPipe=randomUUID(), stage=randomUUID();
  for(const [p,o] of [[pipe,org],[foreignPipe,foreign]]) await pg.query("INSERT INTO pipelines(id,organization_id,name) VALUES($1,$2,$1::uuid::text)",[p,o]);
  await pg.query("INSERT INTO pipeline_stages(id,organization_id,pipeline_id,name,position) VALUES($1,$2,$3,'Open',10)",[stage,org,pipe]);
  await t.test("Deal view rejects foreign and archived pipeline",async()=>{
    const d={id:randomUUID(),entity:"deals" as const,operation:"save" as const,name:"Mine",filters:{pipeline:foreignPipe}};
    assert.equal(await saveView(org,self,d),false);
    await pg.query("UPDATE pipelines SET is_archived=true WHERE id=$1",[pipe]);
    assert.equal(await saveView(org,self,{...d,filters:{pipeline:pipe}}),false);
    await pg.query("UPDATE pipelines SET is_archived=false WHERE id=$1",[pipe]);
    assert.equal(await saveView(org,self,{...d,filters:{pipeline:pipe,owner:"mine",state:"open"}}),true);
  });
  await t.test("50 active view limit is bounded and archival frees a slot",async()=>{
    for(let i=0;i<49;i++) assert.equal(await saveView(org,self,{...draft,id:randomUUID(),name:`View ${i}`}),true);
    assert.equal(await saveView(org,self,{...draft,id:randomUUID(),name:"Overflow"}),false);
    assert.equal(await saveView(org,self,{id,entity:"clients",operation:"archive",version:3}),true);
    assert.equal(await saveView(org,self,{...draft,id:randomUUID(),name:"Freed slot"}),true);
    assert.equal(await saveView(org,self,{id,entity:"clients",operation:"restore",version:4}),false);
  });
  const { deals }=await import("@/db/schema");
  const { dealListConditions,dealReferenceFields }=await import("@/modules/deals/list-filter");
  const database=drizzle(pg);
  for(const [title,owner,date] of [["Mine",self,"CURRENT_DATE + 2"],["Unassigned",null,"NULL"],["Other",other,"CURRENT_DATE - 1"]] as const)
    await pg.query(`INSERT INTO deals(organization_id,pipeline_id,stage_id,title,owner_member_id,expected_close_at) VALUES($1,$2,$3,$4,$5,${date})`,[org,pipe,stage,title,owner]);
  async function titles(extra:Record<string,string>) {
    return (await database.select({title:deals.title}).from(deals).where(and(eq(deals.organizationId,org),eq(deals.pipelineId,pipe),...dealListConditions(dealFilters.parse({pipeline:pipe,...extra}),org,self)))).map(r=>r.title);
  }
  await t.test("Deal ownership, state, text and date filters select the expected records",async()=>{
    assert.deepEqual(await titles({owner:"mine"}),["Mine"]);
    assert.deepEqual(await titles({owner:"unassigned"}),["Unassigned"]);
    assert.deepEqual(await titles({close:"week"}),["Mine"]);
    assert.deepEqual(await titles({close:"overdue"}),["Other"]);
    assert.deepEqual(await titles({close:"none"}),["Unassigned"]);
    assert.deepEqual(await titles({q:"other",state:"open"}),["Other"]);
    assert.deepEqual(await titles({state:"won"}),[]);
  });
  await t.test("hidden related company and member names are absent from SQL",async()=>{
    const hidden=database.select(dealReferenceFields(new Set(),org)).from(deals);
    assert.doesNotMatch(hidden.toSQL().sql,/companies|organization_members/);
    for(const row of await hidden) assert.deepEqual(row,{companyName:null,ownerDisplayName:null});
    const visible=database.select(dealReferenceFields(new Set(["members.read"]),org)).from(deals);
    assert.match(visible.toSQL().sql,/organization_members/);
    assert.doesNotMatch(visible.toSQL().sql,/companies/);
  });
});
