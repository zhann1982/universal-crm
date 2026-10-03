import { z } from "zod";

export const viewEntity = z.enum(["clients", "companies", "deals"]);
export type ViewEntity = z.infer<typeof viewEntity>;
const list = { q: z.string().trim().max(160).default(""), view: z.enum(["active", "archive"]).default("active") };
export const dealFilters = z.object({
  pipeline: z.uuid(),
  q: z.string().trim().max(160).default(""),
  owner: z.enum(["all", "mine", "unassigned"]).default("all"),
  state: z.enum(["all", "open", "won", "lost"]).default("all"),
  close: z.enum(["all", "overdue", "week", "none"]).default("all"),
}).strict();
export function parseFilters(entity: ViewEntity, input: unknown): Record<string, string> {
  if (entity === "deals") return dealFilters.parse(input);
  const status = entity === "clients" ? z.enum(["all", "active", "lead", "inactive"]).default("all") : z.enum(["all", "active", "prospect", "inactive"]).default("all");
  return z.object({ ...list, q: z.string().trim().max(entity === "clients" ? 120 : 160).default(""), status }).strict().parse(input);
}
export function filtersHref(entity: ViewEntity, filters: unknown) {
  return `/crm/${entity}?${new URLSearchParams(parseFilters(entity, filters))}`;
}
