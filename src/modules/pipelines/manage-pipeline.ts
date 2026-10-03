import { randomUUID } from "node:crypto";
import { z } from "zod";
import { sql } from "@/db";
import { DEFAULT_STAGES } from "@/modules/organizations/defaults";

export const pipelineMutation = z.object({
  operation: z.enum(["create", "edit", "default", "archive", "restore", "stage"]),
  pipelineId: z.uuid().optional(),
  version: z.coerce.number().int().positive().optional(),
  name: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(4000).optional(),
  stageId: z.uuid().optional(),
  type: z.enum(["open", "won", "lost"]).optional(),
  probability: z.coerce.number().int().min(0).max(100).optional(),
  position: z.coerce.number().int().min(0).max(100000).optional(),
  color: z.union([z.literal(""), z.string().regex(/^#[0-9a-fA-F]{6}$/)]).optional(),
}).superRefine((value, ctx) => {
  if (value.operation !== "create" && (!value.pipelineId || !value.version))
    ctx.addIssue({ code: "custom", message: "Нет версии воронки" });
  if (["create", "edit", "stage"].includes(value.operation) && !value.name)
    ctx.addIssue({ code: "custom", message: "Введите название" });
  if (value.operation === "stage" && (value.type === undefined || value.probability === undefined || value.position === undefined))
    ctx.addIssue({ code: "custom", message: "Заполните параметры этапа" });
});

// Permission and rendered-tenant scope are checked by the Server Action.
// Lock ordering is organization -> pipelines -> stages; each statement gets a fresh snapshot.
export async function managePipeline(organizationId: string, draft: z.infer<typeof pipelineMutation>) {
  z.uuid().parse(organizationId);
  const input = pipelineMutation.parse(draft);
  const id = input.pipelineId ?? randomUUID();
  const params: (string | number | null)[] = [organizationId, id, input.version ?? 1];
  let query: string;
  if (input.operation === "create") {
    params.push(input.name!, input.description ?? "", JSON.stringify(DEFAULT_STAGES));
    query = `WITH p AS (
      INSERT INTO pipelines (id, organization_id, name, description, is_default)
      SELECT $2::uuid, $1::uuid, $4, NULLIF($5, ''), NOT EXISTS
        (SELECT 1 FROM pipelines WHERE organization_id=$1::uuid AND is_default AND NOT is_archived) WHERE $3::integer > 0
      RETURNING id, organization_id
    ), stages AS (
      INSERT INTO pipeline_stages (organization_id,pipeline_id,name,type,probability,position)
      SELECT p.organization_id,p.id,s.name,s.type,s.probability,s.position FROM p
      CROSS JOIN jsonb_to_recordset($6::jsonb) s(name text,type text,probability integer,position integer)
      RETURNING id
    ) SELECT id FROM p`;
  } else if (input.operation === "edit") {
    params.push(input.name!, input.description ?? "");
    query = `UPDATE pipelines SET name=$4,description=NULLIF($5,''),version=version+1,updated_at=now()
      WHERE organization_id=$1::uuid AND id=$2::uuid AND version=$3 AND NOT is_archived RETURNING id`;
  } else if (input.operation === "stage") {
    params.push(input.stageId ?? randomUUID(), input.name!, input.type!, input.probability!, input.position!, input.color || null);
    query = `WITH eligible AS MATERIALIZED (
      SELECT p.id FROM pipelines p WHERE p.organization_id=$1::uuid AND p.id=$2::uuid AND p.version=$3 AND NOT p.is_archived
      AND (NOT EXISTS (SELECT 1 FROM pipeline_stages WHERE id=$4::uuid)
        OR EXISTS (SELECT 1 FROM pipeline_stages s WHERE s.id=$4::uuid AND s.organization_id=$1::uuid AND s.pipeline_id=p.id
          AND (s.type=$6 OR NOT EXISTS (SELECT 1 FROM deals d WHERE d.stage_id=s.id AND d.deleted_at IS NULL))))
      AND ($6='open' OR EXISTS (SELECT 1 FROM pipeline_stages s WHERE s.pipeline_id=p.id AND s.id<>$4::uuid AND s.type='open'))
    ), changed AS (
      INSERT INTO pipeline_stages (id,organization_id,pipeline_id,name,type,probability,position,color)
      SELECT $4::uuid,$1::uuid,id,$5,$6,$7,$8,$9 FROM eligible
      ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,type=EXCLUDED.type,probability=EXCLUDED.probability,
        position=EXCLUDED.position,color=EXCLUDED.color,updated_at=now() RETURNING pipeline_id
    ) UPDATE pipelines SET version=version+1,updated_at=now() WHERE id IN (SELECT pipeline_id FROM changed) RETURNING id`;
  } else if (input.operation === "default") {
    // Disjoint updates: reset other defaults and choose the expected target atomically.
    query = `WITH eligible AS MATERIALIZED (SELECT id FROM pipelines WHERE organization_id=$1::uuid AND id=$2::uuid AND version=$3 AND NOT is_archived),
      reset AS (UPDATE pipelines SET is_default=false,version=version+1,updated_at=now()
        WHERE organization_id=$1::uuid AND id<>$2::uuid AND is_default AND EXISTS (SELECT 1 FROM eligible) RETURNING id)
      UPDATE pipelines SET is_default=true,version=version+1,updated_at=now() WHERE id IN (SELECT id FROM eligible) RETURNING id`;
  } else {
    const archive = input.operation === "archive";
    query = `UPDATE pipelines SET is_archived=${archive},version=version+1,updated_at=now()
      WHERE organization_id=$1::uuid AND id=$2::uuid AND version=$3 AND is_archived=${!archive}
      ${archive ? `AND NOT is_default AND NOT EXISTS (SELECT 1 FROM deals WHERE pipeline_id=$2::uuid AND NOT is_archived AND deleted_at IS NULL)
        AND EXISTS (SELECT 1 FROM pipelines WHERE organization_id=$1::uuid AND id<>$2::uuid AND NOT is_archived)` : ""} RETURNING id`;
  }
  const results = await sql.transaction((tx) => [
    tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`pipeline-management:${organizationId}`]),
    tx.query("SELECT id FROM pipelines WHERE organization_id=$1::uuid ORDER BY id FOR UPDATE", [organizationId]),
    tx.query(query, params),
  ]);
  return results[2].length ? id : null;
}
