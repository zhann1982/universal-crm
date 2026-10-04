import { z } from "zod";
import { sql } from "@/db";
import { createInvitationToken } from "./invitation-token";

// Server Action authorizes members.manage and rendered tenant scope before calling.
export async function changeInvitation(input: {
  organizationId: string;
  memberId: string;
  invitationId: string;
  expectedExpiresAt: string;
  operation: "revoke" | "reissue";
}) {
  const parsed = z
    .object({
      organizationId: z.uuid(),
      memberId: z.uuid(),
      invitationId: z.uuid(),
      expectedExpiresAt: z.iso.datetime(),
      operation: z.enum(["revoke", "reissue"]),
    })
    .safeParse(input);
  if (!parsed.success) return null;
  const p = parsed.data;
  const { token, tokenHash } = createInvitationToken();
  const result = await sql.transaction((tx) => [
    tx`SELECT pg_advisory_xact_lock(hashtext('universal-crm-invitation-email'),hashtext(email_normalized)) FROM organization_invitations WHERE id=${p.invitationId}::uuid AND organization_id=${p.organizationId}::uuid`,
    tx`UPDATE organization_invitations i SET
 token_hash=CASE WHEN ${p.operation}='reissue' THEN ${tokenHash} ELSE i.token_hash END,
 expires_at=CASE WHEN ${p.operation}='reissue' THEN GREATEST(date_trunc('milliseconds',NOW())+INTERVAL '7 days',i.expires_at+INTERVAL '1 millisecond') ELSE i.expires_at END,
 revoked_at=CASE WHEN ${p.operation}='revoke' THEN NOW() ELSE NULL END,
 updated_at=NOW()
 WHERE i.id=${p.invitationId}::uuid AND i.organization_id=${p.organizationId}::uuid
 AND i.expires_at=${p.expectedExpiresAt}::timestamptz AND i.accepted_at IS NULL AND i.revoked_at IS NULL
 AND EXISTS(SELECT 1 FROM organizations o JOIN organization_members m ON m.organization_id=o.id WHERE o.id=i.organization_id AND o.is_active AND m.id=${p.memberId}::uuid AND m.status='active')
 AND (${p.operation}='revoke' OR EXISTS(SELECT 1 FROM roles r WHERE r.id=i.role_id AND r.organization_id=i.organization_id))
 RETURNING i.id,i.email_normalized,i.expires_at`,
  ]);
  const row = result[1][0] as
    | { id: string; email_normalized: string; expires_at: string | Date }
    | undefined;
  return row
    ? { ...row, token: p.operation === "reissue" ? token : null }
    : null;
}
