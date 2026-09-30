import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireVerifiedSession } from "@/lib/auth/verified-session";
import { ORGANIZATION_COOKIE, resolveSelectedOrganization } from "@/modules/access/organization-selection";

export const getCurrentOrganization = cache(async () => {
  const session = await requireVerifiedSession();
  const selectedId = (await cookies()).get(ORGANIZATION_COOKIE)?.value;
  const organization = await resolveSelectedOrganization(session.user.id, selectedId);
  if (!organization) redirect("/organizations");
  return organization;
});
