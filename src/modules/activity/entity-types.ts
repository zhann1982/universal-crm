import type {
  PermissionKey,
} from "@/lib/auth/permissions";

export const ACTIVITY_ENTITY_TYPES = [
  "client",
  "company",
  "deal",
  "task",
] as const;

export type ActivityEntityType =
  (typeof ACTIVITY_ENTITY_TYPES)[number];

const READ_PERMISSIONS: Record<
  ActivityEntityType,
  PermissionKey
> = {
  client: "clients.read",
  company: "companies.read",
  deal: "deals.read",
  task: "tasks.read",
};

export function getEntityReadPermission(
  entityType: ActivityEntityType,
): PermissionKey {
  return READ_PERMISSIONS[
    entityType
  ];
}

export function getEntityHref(
  entityType: ActivityEntityType,
  entityId: string,
) {
  return entityType === "client"
    ? `/crm/clients/${entityId}`
    : entityType === "company"
      ? `/crm/companies/${entityId}`
      : entityType === "deal"
        ? `/crm/deals/${entityId}`
        : `/crm/tasks/${entityId}`;
}
