import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { pipelines, pipelineStages } from "@/db/schema";
import { requirePermission } from "@/lib/auth/permissions";
import { PipelineForm } from "../form";

export default async function PipelinePage({ params }: { params: Promise<{ id: string }> }) {
  const { organization, permissions } = await requirePermission("pipelines.read");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [pipeline] = await db.select().from(pipelines).where(and(eq(pipelines.id,id),eq(pipelines.organizationId,organization.id))).limit(1);
  if (!pipeline) notFound();
  const stages = await db.select().from(pipelineStages).where(and(eq(pipelineStages.pipelineId,id),eq(pipelineStages.organizationId,organization.id))).orderBy(asc(pipelineStages.position));
  const writable = permissions.has("pipelines.manage") && !pipeline.isArchived;
  const scope = { pipelineId: id, version: pipeline.version };
  return <div className="space-y-6">
    <Link href="/crm/pipelines" className="text-blue-600">← Воронки</Link>
    <h1 className="text-2xl font-semibold">{pipeline.name}{pipeline.isArchived ? " · Архив" : pipeline.isDefault ? " · Основная" : ""}</h1>
    {writable ? <section className="rounded-xl border bg-white p-5"><PipelineForm key={`edit-${pipeline.version}`} operation="edit" {...scope}>
      <label className="block">Название<input name="name" required maxLength={160} defaultValue={pipeline.name} className="mt-1 block w-full rounded border p-2" /></label>
      <label className="block">Описание<textarea name="description" maxLength={4000} defaultValue={pipeline.description ?? ""} className="mt-1 block w-full rounded border p-2" /></label>
    </PipelineForm></section> : <p>{pipeline.description}</p>}
    {permissions.has("pipelines.manage") && <div className="flex flex-wrap gap-4">
      {!pipeline.isArchived && !pipeline.isDefault && <PipelineForm key={`default-${pipeline.version}`} operation="default" {...scope} label="Сделать основной" />}
      {!pipeline.isDefault && <PipelineForm key={`archive-${pipeline.version}`} operation={pipeline.isArchived ? "restore" : "archive"} {...scope} label={pipeline.isArchived ? "Восстановить" : "Архивировать"} />}
    </div>}
    <h2 className="text-xl font-semibold">Этапы</h2>
    <p className="text-sm text-slate-500">Порядок задаётся числом и должен быть уникальным. Тип определяет состояние сделки. Тип используемого этапа изменить нельзя.</p>
    {stages.map(stage => <section key={`${stage.id}-${pipeline.version}`} className="rounded-xl border bg-white p-5">
      {writable ? <PipelineForm operation="stage" {...scope} stageId={stage.id}><StageFields stage={stage} /></PipelineForm>
        : <p>{stage.position}. {stage.name} · {stage.type} · {stage.probability}%</p>}
    </section>)}
    {writable && <section className="rounded-xl border bg-white p-5"><h3 className="mb-4 font-semibold">Добавить этап</h3>
      <PipelineForm key={`new-${pipeline.version}`} operation="stage" {...scope} label="Добавить этап"><StageFields stage={{ name: "", type: "open", probability: 0, position: Math.min(100000, (stages.at(-1)?.position ?? 0)+10), color: null }} /></PipelineForm>
    </section>}
  </div>;
}

function StageFields({ stage }: { stage: { name: string; type: string; probability: number; position: number; color: string | null } }) {
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
    <label>Название<input name="name" required maxLength={160} defaultValue={stage.name} className="mt-1 block w-full rounded border p-2" /></label>
    <label>Тип<select name="type" defaultValue={stage.type} className="mt-1 block w-full rounded border p-2"><option value="open">Открытая</option><option value="won">Успешная</option><option value="lost">Потерянная</option></select></label>
    <label>Вероятность, %<input name="probability" type="number" required min={0} max={100} defaultValue={stage.probability} className="mt-1 block w-full rounded border p-2" /></label>
    <label>Порядок<input name="position" type="number" required min={0} max={100000} defaultValue={stage.position} className="mt-1 block w-full rounded border p-2" /></label>
    <label>Цвет<input name="color" placeholder="#00aabb" pattern="#[0-9a-fA-F]{6}" defaultValue={stage.color ?? ""} className="mt-1 block w-full rounded border p-2" /></label>
  </div>;
}
