"use server";
import { z } from "zod";
import { getCurrentAccessContext } from "@/lib/auth/permissions";
import { readReferenceOptions } from "./read-options";
export async function searchReferences(input: unknown) {
  const parsed = z
    .object({
      organizationId: z.uuid(),
      kind: z.enum(["client", "company", "deal", "member"]),
      query: z.string().max(160),
    })
    .safeParse(input);
  if (!parsed.success) return null;
  const { organization, member, permissions } = await getCurrentAccessContext();
  if (parsed.data.organizationId !== organization.id) return null;
  return readReferenceOptions(
    {
      organizationId: organization.id,
      memberId: member.id,
      memberDisplayName: member.displayName,
      permissions,
    },
    parsed.data.kind,
    parsed.data.query,
  );
}
