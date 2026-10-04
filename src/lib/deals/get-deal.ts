import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/permissions";
import { readDealDetails } from "@/modules/deals/read-deal";

export async function getDealById(dealId: string) {
  const { organization, member, permissions } =
    await requirePermission("deals.read");
  if (!permissions.has("pipelines.read")) redirect("/crm/forbidden");
  return readDealDetails(dealId, {
    organizationId: organization.id,
    memberId: member.id,
    memberDisplayName: member.displayName,
    permissions,
  });
}
