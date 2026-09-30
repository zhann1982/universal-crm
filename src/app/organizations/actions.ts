"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireVerifiedSession } from "@/lib/auth/verified-session";
import { findAccessibleOrganization, ORGANIZATION_COOKIE } from "@/modules/access/organization-selection";

export async function selectOrganization(formData: FormData) {
  const session = await requireVerifiedSession();
  const organization = await findAccessibleOrganization(session.user.id, formData.get("organizationId"));
  if (!organization) redirect("/organizations?reason=unavailable");
  (await cookies()).set(ORGANIZATION_COOKIE, organization.id, {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30,
  });
  revalidatePath("/crm", "layout");
  redirect("/crm");
}
