import { eq } from "drizzle-orm";

import { db } from "@/db";
import { organizations } from "@/db/schema";

export async function getCurrentOrganization() {
  const [organization] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, "development"))
    .limit(1);

  if (!organization) {
    throw new Error("Development organization not found");
  }

  return organization;
}