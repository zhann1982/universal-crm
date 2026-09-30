import { randomUUID } from "node:crypto";
import { z } from "zod";
import { sql } from "@/db";
import { PERMISSIONS } from "@/modules/access/permission-catalog";
import { DEFAULT_ROLES, DEFAULT_STAGES } from "./defaults";

export const organizationDraft = z.object({
  name: z.string().trim().min(1, "Введите название организации").max(160, "Не более 160 символов"),
  requestId: z.uuid(),
});

type CreationResult = { organizationId: string | null; status: "created" | "existing" | "unavailable" | "identity-invalid" };

// The caller supplies only the authenticated session's user ID, never a form identity.
export async function createOrganization(userId: string, draft: z.infer<typeof organizationDraft>): Promise<CreationResult> {
  const input = organizationDraft.parse(draft);
  const organizationId = randomUUID();
  const results = await sql.transaction((tx) => [
    // A separate statement ensures the next snapshot sees the previous request's commit.
    tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`organization-create:${userId}:${input.requestId}`]),
    tx.query(`
      WITH verified_user AS MATERIALIZED (
        SELECT id, name, email FROM "user" WHERE id = $1 AND email_verified = true
      ), previous AS MATERIALIZED (
        SELECT c.organization_id FROM organization_creations c JOIN verified_user u ON u.id = c.user_id
        WHERE c.request_id = $2::uuid
      ), created_org AS (
        INSERT INTO organizations (id, name, slug)
        SELECT $3::uuid, $4, $5 FROM verified_user WHERE NOT EXISTS (SELECT 1 FROM previous)
        RETURNING id
      ), catalog AS (
        INSERT INTO permissions (key, name)
        SELECT p.key, p.name FROM jsonb_to_recordset($6::jsonb) AS p(key text, name text)
        WHERE EXISTS (SELECT 1 FROM created_org)
        ON CONFLICT (key) DO UPDATE SET key = EXCLUDED.key
        RETURNING id, key
      ), created_roles AS (
        INSERT INTO roles (organization_id, name, system_key, description, is_system)
        SELECT o.id, r.name, r."systemKey", r.description, true FROM created_org o
        CROSS JOIN jsonb_to_recordset($7::jsonb) AS r(name text, "systemKey" text, description text, permissions jsonb)
        RETURNING id, system_key
      ), role_bindings AS (
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id FROM created_roles r
        JOIN jsonb_to_recordset($7::jsonb) AS d("systemKey" text, permissions jsonb) ON d."systemKey" = r.system_key
        CROSS JOIN LATERAL jsonb_array_elements_text(d.permissions) k(key)
        JOIN catalog p ON p.key = k.key
        RETURNING role_id
      ), created_member AS (
        INSERT INTO organization_members (organization_id, user_id, display_name, email, status)
        SELECT o.id, u.id, left(u.name, 160), lower(trim(u.email)), 'active' FROM created_org o CROSS JOIN verified_user u
        RETURNING id
      ), owner_binding AS (
        INSERT INTO member_roles (member_id, role_id)
        SELECT m.id, r.id FROM created_member m CROSS JOIN created_roles r WHERE r.system_key = 'owner'
        RETURNING member_id
      ), created_pipeline AS (
        INSERT INTO pipelines (organization_id, name, is_default)
        SELECT id, 'Основная воронка', true FROM created_org RETURNING id, organization_id
      ), created_stages AS (
        INSERT INTO pipeline_stages (organization_id, pipeline_id, name, position, type, probability)
        SELECT p.organization_id, p.id, s.name, s.position, s.type, s.probability FROM created_pipeline p
        CROSS JOIN jsonb_to_recordset($8::jsonb) AS s(name text, position integer, type text, probability integer)
        RETURNING id
      ), creation_record AS (
        INSERT INTO organization_creations (user_id, request_id, organization_id)
        SELECT u.id, $2::uuid, o.id FROM verified_user u CROSS JOIN created_org o RETURNING organization_id
      ), accessible_previous AS (
        SELECT o.id FROM previous p JOIN organizations o ON o.id = p.organization_id AND o.is_active
        JOIN organization_members m ON m.organization_id = o.id AND m.user_id = $1 AND m.status = 'active'
      )
      SELECT id AS "organizationId", 'created' AS status FROM created_org
      UNION ALL SELECT id, 'existing' FROM accessible_previous
      UNION ALL SELECT NULL::uuid, CASE WHEN EXISTS (SELECT 1 FROM verified_user) THEN 'unavailable' ELSE 'identity-invalid' END
      WHERE NOT EXISTS (SELECT 1 FROM created_org) AND NOT EXISTS (SELECT 1 FROM accessible_previous)
    `, [userId, input.requestId, organizationId, input.name, `org-${organizationId}`,
      JSON.stringify(PERMISSIONS), JSON.stringify(DEFAULT_ROLES), JSON.stringify(DEFAULT_STAGES)]),
  ], { isolationLevel: "ReadCommitted" });
  return results[1][0] as CreationResult;
}
