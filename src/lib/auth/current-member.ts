import { requireVerifiedSession } from "./verified-session";
import { redirect } from "next/navigation";
import {
  getCurrentOrganization,
} from "@/lib/current-organization";
import {
  getMembershipForAccess,
} from "@/modules/access/tenant-access";

export async function getCurrentMember() {
  const session = await requireVerifiedSession();

  const organization =
    await getCurrentOrganization();

  const membership =
    await getMembershipForAccess(
      organization.id,
      session.user.id,
    );

  if (
    membership.status !==
    "active"
  ) {
    redirect(
      "/organizations?reason=unavailable",
    );
  }

  return {
    organization,
    member:
      membership.member,

    user:
      session.user,

    session:
      session.session,
  };
}
