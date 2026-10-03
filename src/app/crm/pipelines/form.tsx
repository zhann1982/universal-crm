"use client";

import { useActionState, type ReactNode } from "react";
import { OrganizationForm } from "@/modules/access/organization-context";
import { submitPipeline, type PipelineState } from "./actions";

export function PipelineForm({ operation, pipelineId, version, stageId, children, label = "Сохранить" }: {
  operation: string; pipelineId?: string; version?: number; stageId?: string; children?: ReactNode; label?: string;
}) {
  const [state, action, pending] = useActionState<PipelineState, FormData>(submitPipeline, {});
  return <OrganizationForm action={action} className="space-y-3">
    <input type="hidden" name="operation" value={operation} />
    {pipelineId && <input type="hidden" name="pipelineId" value={pipelineId} />}
    {version && <input type="hidden" name="version" value={version} />}
    {stageId && <input type="hidden" name="stageId" value={stageId} />}
    {children}
    {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
    {state.success && <p role="status" className="text-sm text-emerald-700">{state.success}</p>}
    <button disabled={pending} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50">{pending ? "Сохранение…" : label}</button>
  </OrganizationForm>;
}
