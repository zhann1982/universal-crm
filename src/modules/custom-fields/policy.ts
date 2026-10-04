import type { FieldEntity } from "./validation";
export const fieldPermissions = {
  client: { read: "clients.read", update: "clients.update" },
  company: { read: "companies.read", update: "companies.update" },
  deal: { read: "deals.read", update: "deals.update" },
} as const;
export function canEditValues(
  entity: FieldEntity,
  permissions: ReadonlySet<string>,
) {
  return (
    permissions.has(fieldPermissions[entity].read) &&
    permissions.has(fieldPermissions[entity].update)
  );
}
