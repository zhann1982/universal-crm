import {
  and,
  eq,
  isNull,
} from "drizzle-orm";

import { db } from "@/db";
import {
  companies,
} from "@/db/schema";
import {
  getCurrentOrganization,
} from "@/lib/current-organization";

export async function getCompanyById(
  companyId: string,
) {
  const organization =
    await getCurrentOrganization();

  const [company] =
    await db
      .select()
      .from(companies)
      .where(
        and(
          eq(
            companies.id,
            companyId,
          ),

          eq(
            companies.organizationId,
            organization.id,
          ),

          isNull(
            companies.deletedAt,
          ),
        ),
      )
      .limit(1);

  return company ?? null;
}