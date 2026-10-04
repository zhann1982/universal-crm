import { and, asc, eq } from "drizzle-orm";
import { db, sql } from "@/db";
import { customFieldDefinitions } from "@/db/custom-fields-schema";
import { organizations } from "@/db/schema";
import {
  definitionSchema,
  entitySchema,
  type FieldDefinition,
  type FieldEntity,
  validateValues,
} from "./validation";
import { z } from "zod";

const tables = {
  client: "clients",
  company: "companies",
  deal: "deals",
} as const;
export async function readDefinitions(
  organizationId: string,
  entity: FieldEntity,
) {
  const [organization] = await db
    .select({ revision: organizations.customFieldRevision })
    .from(organizations)
    .where(eq(organizations.id, organizationId));
  const fields = await db
    .select()
    .from(customFieldDefinitions)
    .where(
      and(
        eq(customFieldDefinitions.organizationId, organizationId),
        eq(customFieldDefinitions.entity, entity),
      ),
    )
    .orderBy(
      asc(customFieldDefinitions.position),
      asc(customFieldDefinitions.id),
    )
    .limit(150);
  return {
    revision: organization.revision,
    fields: fields as FieldDefinition[],
  };
}
export async function creationValues(
  organizationId: string,
  entity: FieldEntity,
  form: FormData,
) {
  const config = await readDefinitions(organizationId, entity);
  if (String(config.revision) !== form.get("customFieldSchema"))
    throw new Error("Настройка полей изменилась. Обновите страницу.");
  const input: Record<string, string> = {};
  for (const [name, value] of form)
    if (name.startsWith("custom:")) {
      if (typeof value !== "string" || Object.hasOwn(input, name.slice(7)))
        throw new Error("Некорректные значения полей.");
      input[name.slice(7)] = value;
    }
  return {
    customFields: validateValues(config.fields, input),
    customFieldSchema: config.revision,
  };
}
export async function saveValues(p: {
  organizationId: string;
  memberId: string;
  entity: FieldEntity;
  id: string;
  version: number;
  revision: number;
  input: Record<string, string>;
}) {
  z.uuid().parse(p.id);
  z.uuid().parse(p.organizationId);
  z.uuid().parse(p.memberId);
  z.number().int().positive().parse(p.version);
  z.number().int().nonnegative().parse(p.revision);
  entitySchema.parse(p.entity);
  const table = tables[p.entity];
  const config = await readDefinitions(p.organizationId, p.entity);
  if (config.revision !== p.revision)
    throw new Error("Настройка полей изменилась. Обновите страницу.");
  // Parent and configuration locks precede the write in separate READ COMMITTED statements.
  const result = await sql.transaction((tx) => [
    tx.query("SELECT id FROM organizations WHERE id=$1 FOR SHARE", [
      p.organizationId,
    ]),
    tx.query(
      `SELECT id FROM ${table} WHERE id=$1 AND organization_id=$2 FOR UPDATE`,
      [p.id, p.organizationId],
    ),
    tx.query(
      "SELECT set_config('crm.activity_actor',$1,true),set_config('crm.activity_organization',$2,true)",
      [p.memberId, p.organizationId],
    ),
    tx.query(
      `UPDATE ${table} SET custom_fields = custom_fields || $3::jsonb, custom_field_schema=$4, custom_fields_version=custom_fields_version+1, updated_at=NOW()${p.entity === "deal" ? ", version=version+1" : ""}
      WHERE id=$1 AND organization_id=$2 AND NOT is_archived AND deleted_at IS NULL AND custom_fields_version=$5
      AND EXISTS(SELECT 1 FROM organizations WHERE id=$2 AND custom_field_revision=$4 AND is_active)
      AND EXISTS(SELECT 1 FROM organization_members WHERE id=$6 AND organization_id=$2 AND status='active')
      RETURNING custom_fields_version`,
      [
        p.id,
        p.organizationId,
        JSON.stringify(valuePatch(config.fields, p.input)),
        p.revision,
        p.version,
        p.memberId,
      ],
    ),
  ]);
  return result[3][0] ? Number(result[3][0].custom_fields_version) : null;
}
function valuePatch(fields: FieldDefinition[], input: Record<string, string>) {
  const parsed = validateValues(fields, input);
  // Empty values are retained as empty strings; the trigger canonicalizes them away.
  return Object.fromEntries(
    fields.filter((f) => !f.archived).map((f) => [f.id, parsed[f.id] ?? ""]),
  );
}
export async function manageDefinition(p: {
  organizationId: string;
  memberId: string;
  entity: FieldEntity;
  id?: string;
  version?: number;
  operation: "create" | "update" | "archive" | "restore";
  data: z.infer<typeof definitionSchema>;
}) {
  const data = definitionSchema.parse(p.data);
  z.uuid().parse(p.organizationId);
  z.uuid().parse(p.memberId);
  if (data.entity !== p.entity) throw new Error("Entity mismatch");
  if (p.operation !== "create") z.number().int().positive().parse(p.version);
  if (p.id) z.uuid().parse(p.id);
  const results = await sql.transaction((tx) => [
    tx.query(
      "SELECT id FROM organizations WHERE id=$1 AND is_active FOR UPDATE",
      [p.organizationId],
    ),
    p.operation === "create"
      ? tx.query(
          `INSERT INTO custom_field_definitions(organization_id,entity,name,type,required,position,options)
        SELECT $1,$2,$3,$4,$5,$6,$7::jsonb WHERE EXISTS(SELECT 1 FROM organizations o JOIN organization_members m ON m.organization_id=o.id WHERE o.id=$1 AND o.is_active AND m.id=$8 AND m.status='active') RETURNING id`,
          [
            p.organizationId,
            data.entity,
            data.name,
            data.type,
            data.required,
            data.position,
            JSON.stringify(data.options),
            p.memberId,
          ],
        )
      : tx.query(
          `UPDATE custom_field_definitions SET name=$4,required=$5,position=$6,archived=$7,version=version+1
        WHERE organization_id=$1 AND entity=$2 AND id=$3 AND version=$8 AND archived=$9
        AND EXISTS(SELECT 1 FROM organizations o JOIN organization_members m ON m.organization_id=o.id WHERE o.id=$1 AND o.is_active AND m.id=$10 AND m.status='active') RETURNING id`,
          [
            p.organizationId,
            p.entity,
            p.id,
            data.name,
            data.required,
            data.position,
            p.operation === "archive",
            p.version,
            p.operation === "restore",
            p.memberId,
          ],
        ),
  ]);
  return results[1].length > 0;
}
