import type { ActivityEntityType } from "./entity-types";

const ENTITY_TABLES: Record<ActivityEntityType, string> = {
  client: "clients", company: "companies", deal: "deals", task: "tasks",
};

// Only fixed table identifiers can enter SQL. All callers bind parent ID at $1
// and Organization at $2, then acquire the parent lock before a comment write.
export function writableCommentTargetSql(entityType: ActivityEntityType): string {
  if (!Object.hasOwn(ENTITY_TABLES, entityType)) {
    throw new Error("Unsupported comment entity type");
  }
  return `SELECT id FROM ${ENTITY_TABLES[entityType]}
    WHERE id = $1::uuid AND organization_id = $2::uuid
      AND is_archived = false AND deleted_at IS NULL
    FOR UPDATE`;
}
