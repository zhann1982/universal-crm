import { z } from "zod";
import { sql } from "@/db";
import { parseFilters, viewEntity, type ViewEntity } from "./filters";

export const savedViewDraft = z.object({
  id: z.uuid(), entity: viewEntity, operation: z.enum(["save", "archive", "restore"]),
  version: z.coerce.number().int().positive().optional(),
  name: z.string().trim().min(1).max(80).optional(),
  filters: z.unknown().optional(),
}).superRefine((v, ctx) => {
  if (v.operation === "save" && !v.name) ctx.addIssue({ code: "custom", message: "Введите название" });
  if (v.operation !== "save" && !v.version) ctx.addIssue({ code: "custom", message: "Нет версии" });
});

// Identity is supplied by the authorized server context, never by the form.
export async function saveView(organizationId: string, memberId: string, draft: z.infer<typeof savedViewDraft>) {
  z.uuid().parse(organizationId); z.uuid().parse(memberId);
  const input = savedViewDraft.parse(draft);
  const params: (string | number | null)[] = [organizationId, memberId, input.entity, input.id];
  let query: string;
  if (input.operation === "save") {
    const filters = parseFilters(input.entity, input.filters);
    params.push(input.name!, JSON.stringify(filters), filters.pipeline ?? null);
    query = `INSERT INTO saved_views(id,organization_id,member_id,entity,name,filters)
      SELECT $4::uuid,$1::uuid,$2::uuid,$3::text,$5::text,$6::jsonb
      WHERE (SELECT count(*) FROM saved_views WHERE organization_id=$1::uuid AND member_id=$2::uuid AND entity=$3 AND NOT is_archived)<50
      AND ($7::uuid IS NULL OR EXISTS (SELECT 1 FROM pipelines WHERE id=$7::uuid AND organization_id=$1::uuid AND NOT is_archived))
      ON CONFLICT (id) DO NOTHING RETURNING id`;
  } else {
    params.push(input.version!);
    const archive = input.operation === "archive";
    query = `UPDATE saved_views SET is_archived=${archive},version=version+1,updated_at=now()
      WHERE organization_id=$1::uuid AND member_id=$2::uuid AND entity=$3 AND id=$4::uuid AND version=$5 AND is_archived=${!archive}
      ${archive ? "" : "AND (SELECT count(*) FROM saved_views WHERE organization_id=$1::uuid AND member_id=$2::uuid AND entity=$3 AND NOT is_archived)<50"} RETURNING id`;
  }
  const results = await sql.transaction(tx => [
    tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`saved-view:${organizationId}:${memberId}:${input.entity}`]),
    tx.query(query, params),
  ]);
  return results[1].length > 0;
}

export async function readViews(organizationId: string, memberId: string, entity: ViewEntity) {
  // Bound both active and historical UI lists independently.
  return sql.query(`(SELECT id,name,filters,version,is_archived FROM saved_views
    WHERE organization_id=$1::uuid AND member_id=$2::uuid AND entity=$3 AND NOT is_archived ORDER BY name LIMIT 50)
    UNION ALL (SELECT id,name,filters,version,is_archived FROM saved_views
    WHERE organization_id=$1::uuid AND member_id=$2::uuid AND entity=$3 AND is_archived ORDER BY updated_at DESC LIMIT 50)`, [organizationId, memberId, entity]);
}
