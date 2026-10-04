import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { isolatedPostgres } from "@/test/isolated-postgres";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/unused";
test("invitation administration rotates tokens and serializes email identity without resurrecting accepted/revoked invitations", async (t) => {
  const pg = await isolatedPostgres(t);
  const { createInvitation } = await import("./create-invitation");
  const { changeInvitation } = await import("./change-invitation");
  const { hashInvitationToken } = await import("./invitation-token");
  const org = randomUUID(),
    member = randomUUID(),
    role = randomUUID();
  await pg.query(
    "INSERT INTO organizations(id,name,slug)VALUES($1,'Test',$1::uuid::text)",
    [org],
  );
  await pg.query(
    "INSERT INTO organization_members(id,organization_id,user_id)VALUES($1,$2,$1::uuid::text)",
    [member, org],
  );
  await pg.query(
    "INSERT INTO roles(id,organization_id,name)VALUES($1,$2,'Test')",
    [role, org],
  );
  const invitation = await createInvitation({
    organizationId: org,
    invitedByMemberId: member,
    email: " New_User@Example.com ",
    roleId: role,
  });
  assert.equal(invitation.status, "created");
  if (invitation.status !== "created") throw new Error("fixture");
  const input = {
    organizationId: org,
    memberId: member,
    invitationId: invitation.invitationId,
    expectedExpiresAt: invitation.expiresAt.toISOString(),
    operation: "reissue" as const,
  };
  assert.equal(
    await changeInvitation({ ...input, organizationId: randomUUID() }),
    null,
  );
  const changed = await changeInvitation(input);
  assert.ok(changed?.token);
  assert.notEqual(changed.token, invitation.token);
  const stored = (
    await pg.query<{ token_hash: string }>(
      "SELECT token_hash FROM organization_invitations WHERE id=$1",
      [invitation.invitationId],
    )
  ).rows[0];
  assert.equal(stored.token_hash, hashInvitationToken(changed.token));
  assert.notEqual(stored.token_hash, hashInvitationToken(invitation.token));
  assert.equal(await changeInvitation(input), null);
  const latest = {
    ...input,
    expectedExpiresAt: new Date(changed.expires_at).toISOString(),
  };
  assert.ok(await changeInvitation({ ...latest, operation: "revoke" }));
  assert.equal(await changeInvitation(latest), null);
  const second = await createInvitation({
    organizationId: org,
    invitedByMemberId: member,
    email: "new_user@example.com",
    roleId: role,
  });
  assert.equal(second.status, "created");
  if (second.status !== "created") throw new Error("fixture");
  await pg.query(
    "UPDATE organization_invitations SET accepted_at=NOW() WHERE id=$1",
    [second.invitationId],
  );
  assert.equal(
    await changeInvitation({
      ...input,
      invitationId: second.invitationId,
      expectedExpiresAt: second.expiresAt.toISOString(),
    }),
    null,
  );
});
