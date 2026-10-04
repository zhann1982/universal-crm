import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { isolatedPostgres } from "@/test/isolated-postgres";
import {
  definitionSchema,
  validateValues,
  type FieldDefinition,
} from "./validation";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/unused";

test("custom field validation rejects ambiguous definitions and impossible values", () => {
  const base = {
    entity: "client" as const,
    name: "Поле",
    required: false,
    position: 0,
    options: [],
  };
  assert.equal(
    definitionSchema.safeParse({ ...base, type: "select", options: ["A", "A"] })
      .success,
    false,
  );
  assert.equal(
    definitionSchema.safeParse({ ...base, type: "text", options: ["A"] })
      .success,
    false,
  );
  const f: FieldDefinition = {
    ...base,
    type: "date",
    id: randomUUID(),
    version: 1,
    archived: false,
  };
  assert.throws(() => validateValues([f], { [f.id]: "2025-02-29" }));
  assert.deepEqual(validateValues([f], { [f.id]: "2024-02-29" }), {
    [f.id]: "2024-02-29",
  });
  assert.throws(() =>
    validateValues([{ ...f, type: "number" }], { [f.id]: "NaN" }),
  );
  assert.throws(() =>
    validateValues([{ ...f, type: "boolean", required: true }], {}),
  );
  assert.deepEqual(
    validateValues([{ ...f, type: "boolean", required: true }], {
      [f.id]: "false",
    }),
    { [f.id]: "false" },
  );
  assert.throws(() => validateValues([f], { [randomUUID()]: "foreign" }));
});

test("custom fields use actual PostgreSQL constraints, tenant scope, optimistic versions and atomic history", async (t) => {
  const pg = await isolatedPostgres(t);
  const { manageDefinition, readDefinitions, saveValues, creationValues } =
    await import("./persistence");
  const org = randomUUID(),
    foreign = randomUUID(),
    member = randomUUID();
  for (const id of [org, foreign])
    await pg.query(
      "INSERT INTO organizations(id,name,slug) VALUES($1,'Test',$1::uuid::text)",
      [id],
    );
  await pg.query(
    "INSERT INTO organization_members(id,organization_id,user_id,display_name) VALUES($1,$2,$1::uuid::text,'Actor')",
    [member, org],
  );
  const client = randomUUID(),
    company = randomUUID(),
    deal = randomUUID(),
    pipeline = randomUUID(),
    stage = randomUUID();
  await pg.query(
    "INSERT INTO clients(id,organization_id,first_name) VALUES($1,$2,'Client')",
    [client, org],
  );
  await pg.query(
    "INSERT INTO companies(id,organization_id,name) VALUES($1,$2,'Company')",
    [company, org],
  );
  await pg.query(
    "INSERT INTO pipelines(id,organization_id,name) VALUES($1,$2,'Pipeline')",
    [pipeline, org],
  );
  await pg.query(
    "INSERT INTO pipeline_stages(id,organization_id,pipeline_id,name,position) VALUES($1,$2,$3,'Open',0)",
    [stage, org, pipeline],
  );
  await pg.query(
    "INSERT INTO deals(id,organization_id,pipeline_id,stage_id,title) VALUES($1,$2,$3,$4,'Deal')",
    [deal, org, pipeline, stage],
  );
  const data = {
    entity: "client" as const,
    name: "Источник",
    type: "select" as const,
    required: true,
    position: 0,
    options: ["Сайт", "Рекомендация"],
  };
  assert.equal(
    await manageDefinition({
      memberId: member,
      organizationId: org,
      entity: "client",
      operation: "create",
      data,
    }),
    true,
  );
  let config = await readDefinitions(org, "client");
  const field = config.fields[0];
  const input = { [field.id]: "Сайт" };
  const params = {
    organizationId: org,
    memberId: member,
    entity: "client" as const,
    id: client,
    version: 1,
    revision: config.revision,
    input,
  };

  await t.test(
    "creation carries values and rejects stale configuration and missing required values",
    async () => {
      const form = new FormData();
      form.set("customFieldSchema", String(config.revision));
      form.set(`custom:${field.id}`, "Сайт");
      const values = await creationValues(org, "client", form);
      assert.deepEqual(values.customFields, input);
      await pg.query(
        "INSERT INTO clients(organization_id,first_name,custom_fields,custom_field_schema) VALUES($1,'New',$2,$3)",
        [org, JSON.stringify(values.customFields), values.customFieldSchema],
      );
      await assert.rejects(
        pg.query(
          "INSERT INTO clients(organization_id,first_name,custom_field_schema) VALUES($1,'Invalid',$2)",
          [org, config.revision],
        ),
      );
      form.set("customFieldSchema", "0");
      await assert.rejects(creationValues(org, "client", form));
      await assert.rejects(
        pg.query(
          "INSERT INTO clients(organization_id,first_name,custom_fields) VALUES($1,'Stale',$2)",
          [org, JSON.stringify(input)],
        ),
      );
    },
  );
  await t.test(
    "same-tenant values are saved once and stale forms cannot overwrite",
    async () => {
      assert.equal(await saveValues(params), 2);
      assert.equal(
        await saveValues({ ...params, input: { [field.id]: "Рекомендация" } }),
        null,
      );
      assert.equal(
        await saveValues({
          ...params,
          organizationId: foreign,
          revision: 0,
          input: {},
        }),
        null,
      );
      const events = (
        await pg.query<{ summary: string }>(
          "SELECT summary FROM activity_events WHERE entity_id=$1",
          [client],
        )
      ).rows;
      assert.deepEqual(events, [
        { summary: "Пользовательские поля: изменение" },
      ]);
    },
  );
  await t.test(
    "direct SQL cannot bypass type, required, entity or tenant invariants",
    async () => {
      for (const value of ["Чужой вариант", 42, null])
        await assert.rejects(
          pg.query("UPDATE clients SET custom_fields=$2 WHERE id=$1", [
            client,
            JSON.stringify({ [field.id]: value }),
          ]),
        );
      await assert.rejects(
        pg.query("UPDATE clients SET custom_fields='{}' WHERE id=$1", [client]),
      );
      await assert.rejects(
        pg.query(
          "UPDATE companies SET custom_fields=$2,custom_field_schema=$3 WHERE id=$1",
          [company, JSON.stringify(input), config.revision],
        ),
      );
      await assert.rejects(
        pg.query("UPDATE clients SET custom_fields=$2 WHERE id=$1", [
          client,
          JSON.stringify({ [randomUUID()]: "foreign" }),
        ]),
      );
    },
  );
  await t.test(
    "configuration versions, immutable type and archive preserve values",
    async () => {
      assert.equal(
        await manageDefinition({
          memberId: member,
          organizationId: foreign,
          entity: "client",
          id: field.id,
          version: 1,
          operation: "archive",
          data,
        }),
        false,
      );
      await assert.rejects(
        pg.query(
          "UPDATE custom_field_definitions SET type='text' WHERE id=$1",
          [field.id],
        ),
      );
      await assert.rejects(
        pg.query("DELETE FROM custom_field_definitions WHERE id=$1", [
          field.id,
        ]),
      );
      assert.equal(
        await manageDefinition({
          memberId: member,
          organizationId: org,
          entity: "client",
          id: field.id,
          version: 1,
          operation: "archive",
          data,
        }),
        true,
      );
      assert.equal(
        await manageDefinition({
          memberId: member,
          organizationId: org,
          entity: "client",
          id: field.id,
          version: 1,
          operation: "restore",
          data,
        }),
        false,
      );
      config = await readDefinitions(org, "client");
      assert.equal(
        (
          await pg.query<{ custom_fields: Record<string, string> }>(
            "SELECT custom_fields FROM clients WHERE id=$1",
            [client],
          )
        ).rows[0].custom_fields[field.id],
        "Сайт",
      );
      assert.equal(
        await saveValues({
          ...params,
          version: 2,
          revision: config.revision,
          input: {},
        }),
        3,
      );
      await assert.rejects(
        pg.query("UPDATE clients SET custom_fields=$2 WHERE id=$1", [
          client,
          JSON.stringify({ [field.id]: "Рекомендация" }),
        ]),
      );
      assert.equal(
        await manageDefinition({
          memberId: member,
          organizationId: org,
          entity: "client",
          id: field.id,
          version: 2,
          operation: "restore",
          data,
        }),
        true,
      );
      config = await readDefinitions(org, "client");
      await assert.rejects(
        saveValues({ ...params, version: 3, revision: params.revision }),
      );
    },
  );
  await t.test("archived and deleted parents reject values", async () => {
    await pg.query("UPDATE clients SET is_archived=true WHERE id=$1", [client]);
    assert.equal(
      await saveValues({ ...params, version: 3, revision: config.revision }),
      null,
    );
    await assert.rejects(
      pg.query(
        "UPDATE clients SET custom_fields=$2,custom_field_schema=$3 WHERE id=$1",
        [
          client,
          JSON.stringify({ [field.id]: "Рекомендация" }),
          config.revision,
        ],
      ),
    );
    await pg.query(
      "UPDATE clients SET is_archived=false,deleted_at=NOW() WHERE id=$1",
      [client],
    );
    assert.equal(
      await saveValues({ ...params, version: 3, revision: config.revision }),
      null,
    );
  });
  await t.test(
    "Company and Deal values share validation; Deal writes advance the main version",
    async () => {
      for (const [entity, id] of [
        ["company", company],
        ["deal", deal],
      ] as const) {
        await manageDefinition({
          memberId: member,
          organizationId: org,
          entity,
          operation: "create",
          data: { ...data, entity, type: "text", options: [], required: false },
        });
        const c = await readDefinitions(org, entity);
        assert.equal(
          await saveValues({
            organizationId: org,
            memberId: member,
            entity,
            id,
            version: 1,
            revision: c.revision,
            input: { [c.fields[0].id]: "Private value" },
          }),
          2,
        );
      }
      assert.equal(
        (
          await pg.query<{ version: number }>(
            "SELECT version FROM deals WHERE id=$1",
            [deal],
          )
        ).rows[0].version,
        2,
      );
      assert.doesNotMatch(
        JSON.stringify(
          (
            await pg.query(
              "SELECT summary,details FROM activity_events WHERE entity_id=$1",
              [deal],
            )
          ).rows,
        ),
        /Private value/,
      );
    },
  );
  await t.test(
    "all five types enforce PostgreSQL validation and optional values can be cleared",
    async () => {
      const fieldIds: Record<string, string> = {};
      for (const type of ["number", "date", "boolean", "select"] as const) {
        await manageDefinition({
          memberId: member,
          organizationId: org,
          entity: "company",
          operation: "create",
          data: {
            ...data,
            entity: "company",
            name: type,
            type,
            options: type === "select" ? ["A", "B"] : [],
            required: false,
          },
        });
        const c = await readDefinitions(org, "company");
        fieldIds[type] = c.fields.find((f) => f.type === type)!.id;
      }
      const c = await readDefinitions(org, "company");
      const input = {
        [fieldIds.number]: "-12.345678",
        [fieldIds.date]: "2024-02-29",
        [fieldIds.boolean]: "false",
        [fieldIds.select]: "B",
      };
      assert.equal(
        await saveValues({
          organizationId: org,
          memberId: member,
          entity: "company",
          id: company,
          version: 2,
          revision: c.revision,
          input,
        }),
        3,
      );
      for (const [type, invalid] of [
        ["number", "Infinity"],
        ["number", "1e5"],
        ["number", "1.1234567"],
        ["date", "2025-02-29"],
        ["date", "2024-13-01"],
        ["boolean", "yes"],
        ["select", "C"],
      ]) {
        await assert.rejects(
          pg.query(
            "UPDATE companies SET custom_fields=custom_fields||$2::jsonb WHERE id=$1",
            [company, JSON.stringify({ [fieldIds[type]]: invalid })],
          ),
        );
      }
      assert.equal(
        await saveValues({
          organizationId: org,
          memberId: member,
          entity: "company",
          id: company,
          version: 3,
          revision: c.revision,
          input: {},
        }),
        4,
      );
      assert.deepEqual(
        (
          await pg.query<{ custom_fields: object }>(
            "SELECT custom_fields FROM companies WHERE id=$1",
            [company],
          )
        ).rows[0].custom_fields,
        {},
      );
    },
  );
  await t.test(
    "revoked actors cannot save and definition failures preserve configuration revision",
    async () => {
      const c = await readDefinitions(org, "deal");
      await pg.query(
        "UPDATE organization_members SET status='inactive' WHERE id=$1",
        [member],
      );
      assert.equal(
        await saveValues({
          organizationId: org,
          memberId: member,
          entity: "deal",
          id: deal,
          version: 2,
          revision: c.revision,
          input: { [c.fields[0].id]: "Changed" },
        }),
        null,
      );
      await pg.query(
        "UPDATE organization_members SET status='active' WHERE id=$1",
        [member],
      );
      const before = c.revision;
      await assert.rejects(
        manageDefinition({
          memberId: member,
          organizationId: org,
          entity: "deal",
          operation: "create",
          data: {
            ...data,
            entity: "deal",
            type: "text",
            options: [],
            required: false,
          },
        }),
      );
      assert.equal((await readDefinitions(org, "deal")).revision, before);
    },
  );
  await t.test(
    "field limits are enforced in PostgreSQL and failed restores roll back configuration",
    async () => {
      const scope = randomUUID(),
        actor = randomUUID();
      await pg.query(
        "INSERT INTO organizations(id,name,slug) VALUES($1,'Limits',$1::uuid::text)",
        [scope],
      );
      await pg.query(
        "INSERT INTO organization_members(id,organization_id,user_id) VALUES($1,$2,$1::uuid::text)",
        [actor, scope],
      );
      await pg.query(
        "INSERT INTO custom_field_definitions(organization_id,entity,name,type) SELECT $1,'client','Field '||n,'text' FROM generate_series(1,50) n",
        [scope],
      );
      await assert.rejects(
        manageDefinition({
          organizationId: scope,
          memberId: actor,
          entity: "client",
          operation: "create",
          data: {
            ...data,
            name: "Extra",
            type: "text",
            options: [],
            required: false,
          },
        }),
      );
      const c = await readDefinitions(scope, "client"),
        f = c.fields[0];
      const p = {
        organizationId: scope,
        memberId: actor,
        entity: "client" as const,
        id: f.id,
        version: 1,
        data: {
          entity: "client" as const,
          name: f.name,
          type: "text" as const,
          options: [],
          required: false,
          position: 0,
        },
      };
      assert.equal(
        await manageDefinition({ ...p, operation: "archive" }),
        true,
      );
      assert.equal(
        await manageDefinition({
          organizationId: scope,
          memberId: actor,
          entity: "client",
          operation: "create",
          data: {
            ...data,
            name: "Extra",
            type: "text",
            options: [],
            required: false,
          },
        }),
        true,
      );
      const before = (await readDefinitions(scope, "client")).revision;
      await assert.rejects(
        manageDefinition({ ...p, version: 2, operation: "restore" }),
      );
      assert.equal((await readDefinitions(scope, "client")).revision, before);
      await pg.query(
        "INSERT INTO custom_field_definitions(organization_id,entity,name,type,archived) SELECT $1,'client','Archived '||n,'text',true FROM generate_series(1,99) n",
        [scope],
      );
      assert.equal((await readDefinitions(scope, "client")).fields.length, 150);
      await assert.rejects(
        pg.query(
          "INSERT INTO custom_field_definitions(organization_id,entity,name,type,archived) VALUES($1,'client','Overflow','text',true)",
          [scope],
        ),
      );
    },
  );
  await t.test(
    "an Activity failure rolls back custom values and both versions",
    async () => {
      const c = await readDefinitions(org, "deal");
      await pg.exec(
        "CREATE FUNCTION reject_custom_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fault'; END $$; CREATE TRIGGER reject_custom_event BEFORE INSERT ON activity_events FOR EACH ROW EXECUTE FUNCTION reject_custom_event();",
      );
      await assert.rejects(
        saveValues({
          organizationId: org,
          memberId: member,
          entity: "deal",
          id: deal,
          version: 2,
          revision: c.revision,
          input: { [c.fields[0].id]: "Changed" },
        }),
      );
      const row = (
        await pg.query<{
          version: number;
          custom_fields_version: number;
          custom_fields: Record<string, string>;
        }>(
          "SELECT version,custom_fields_version,custom_fields FROM deals WHERE id=$1",
          [deal],
        )
      ).rows[0];
      assert.equal(row.version, 2);
      assert.equal(row.custom_fields_version, 2);
      assert.equal(row.custom_fields[c.fields[0].id], "Private value");
    },
  );
});
