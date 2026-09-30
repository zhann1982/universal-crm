import {
  and,
  eq,
  isNull,
} from "drizzle-orm";

import { db } from "@/db";
import {
  clients,
  companies,
  deals,
  tasks,
} from "@/db/schema";

import type {
  ActivityEntityType,
} from "./entity-types";

export type EntityTarget = {
  id: string;
  isArchived: boolean;
};

export async function getEntityTarget({
  organizationId,
  entityType,
  entityId,
}: {
  organizationId: string;
  entityType: ActivityEntityType;
  entityId: string;
}): Promise<EntityTarget | null> {
  if (entityType === "client") {
    const [row] = await db
      .select({
        id: clients.id,
        isArchived:
          clients.isArchived,
      })
      .from(clients)
      .where(
        and(
          eq(
            clients.id,
            entityId,
          ),
          eq(
            clients.organizationId,
            organizationId,
          ),
          isNull(
            clients.deletedAt,
          ),
        ),
      )
      .limit(1);

    return row ?? null;
  }

  if (entityType === "company") {
    const [row] = await db
      .select({
        id: companies.id,
        isArchived:
          companies.isArchived,
      })
      .from(companies)
      .where(
        and(
          eq(
            companies.id,
            entityId,
          ),
          eq(
            companies.organizationId,
            organizationId,
          ),
          isNull(
            companies.deletedAt,
          ),
        ),
      )
      .limit(1);

    return row ?? null;
  }

  if (entityType === "deal") {
    const [row] = await db
      .select({
        id: deals.id,
        isArchived:
          deals.isArchived,
      })
      .from(deals)
      .where(
        and(
          eq(
            deals.id,
            entityId,
          ),
          eq(
            deals.organizationId,
            organizationId,
          ),
          isNull(
            deals.deletedAt,
          ),
        ),
      )
      .limit(1);

    return row ?? null;
  }

  const [row] = await db
    .select({
      id: tasks.id,
      isArchived:
        tasks.isArchived,
    })
    .from(tasks)
    .where(
      and(
        eq(
          tasks.id,
          entityId,
        ),
        eq(
          tasks.organizationId,
          organizationId,
        ),
        isNull(
          tasks.deletedAt,
        ),
      ),
    )
    .limit(1);

  return row ?? null;
}
