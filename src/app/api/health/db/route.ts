import { count } from "drizzle-orm";

import { db } from "@/db";
import {
  clients,
  organizationMembers,
  organizations,
  permissions,
  roles,
} from "@/db/schema";

export async function GET() {
  try {
    const [organizationsResult] = await db
      .select({ count: count() })
      .from(organizations);

    const [membersResult] = await db
      .select({ count: count() })
      .from(organizationMembers);

    const [rolesResult] = await db
      .select({ count: count() })
      .from(roles);

    const [permissionsResult] = await db
      .select({ count: count() })
      .from(permissions);

    const [clientsResult] = await db
      .select({ count: count() })
      .from(clients);

    return Response.json({
      ok: true,
      database: "connected",
      counts: {
        organizations: organizationsResult.count,
        members: membersResult.count,
        roles: rolesResult.count,
        permissions: permissionsResult.count,
        clients: clientsResult.count,
      },
    });
  } catch (error) {
    console.error("Database health check failed:", error);

    return Response.json(
      {
        ok: false,
        database: "error",
      },
      {
        status: 500,
      },
    );
  }
}