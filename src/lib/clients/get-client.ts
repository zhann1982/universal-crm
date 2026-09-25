import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { clients } from "@/db/schema";
import { getCurrentOrganization } from "@/lib/current-organization";

export async function getClientById(
  clientId: string,
) {
  const organization =
    await getCurrentOrganization();

  const [client] = await db
    .select()
    .from(clients)
    .where(
      and(
        eq(clients.id, clientId),
        eq(
          clients.organizationId,
          organization.id,
        ),
        isNull(clients.deletedAt),
      ),
    )
    .limit(1);

  return client ?? null;
}