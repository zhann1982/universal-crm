"use client";

import { useToastActionState } from "@/modules/notifications/use-toast-action-state";


import { OrganizationForm } from "@/modules/access/organization-context";
import { submitSavedView } from "./actions";
import type { ViewEntity } from "./filters";

export function SavedViewForm({ entity, filters, id, version, operation = "save" }: {
  entity: ViewEntity; filters?: Record<string,string>; id: string; version?: number; operation?: "save" | "archive" | "restore";
}) {
  const [state, action, pending] = useToastActionState(submitSavedView, {});
  return <OrganizationForm action={action} className="flex flex-wrap items-center gap-2">
    <input type="hidden" name="entity" value={entity} /><input type="hidden" name="id" value={id} />
    <input type="hidden" name="operation" value={operation} />
    {version && <input type="hidden" name="version" value={version} />}
    {filters && <input type="hidden" name="filters" value={JSON.stringify(filters)} />}
    {operation === "save" && <input aria-label="Название представления" name="name" required maxLength={80} placeholder="Название представления" className="rounded border px-3 py-2 text-sm" />}
    <button disabled={pending} className="rounded border px-3 py-2 text-sm disabled:opacity-50">{pending ? "Сохранение…" : operation === "save" ? "Сохранить фильтры" : operation === "archive" ? "В архив" : "Восстановить"}</button>
    {state.message && <span role="status" className="text-sm">{state.message}</span>}
  </OrganizationForm>;
}
