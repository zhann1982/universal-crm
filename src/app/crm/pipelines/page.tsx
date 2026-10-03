import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { pipelines } from "@/db/schema";
import { requirePermission } from "@/lib/auth/permissions";
import { PipelineForm } from "./form";

export default async function PipelinesPage() {
  const { organization, permissions } = await requirePermission("pipelines.read");
  const rows = await db.select().from(pipelines).where(eq(pipelines.organizationId, organization.id)).orderBy(asc(pipelines.isArchived), asc(pipelines.name));
  const canManage = permissions.has("pipelines.manage");
  return <div className="space-y-6">
    <h1 className="text-2xl font-semibold">Воронки продаж</h1>
    <p className="text-sm text-slate-500">Настройте этапы под процессы вашей организации.</p>
    <div className="rounded-xl border bg-white p-5"><ul className="divide-y">
      {rows.map(p => <li key={p.id} className="flex items-center justify-between gap-4 py-4">
        <Link className="text-blue-600" href={`/crm/pipelines/${p.id}`}>{p.name}</Link>
        <span className="text-sm text-slate-500">{p.isArchived ? "Архив" : p.isDefault ? "Основная" : "Активная"}</span>
      </li>)}
    </ul></div>
    {canManage && <section className="rounded-xl border bg-white p-5"><h2 className="mb-4 text-lg font-semibold">Новая воронка</h2>
      <PipelineForm operation="create" label="Создать воронку">
        <label className="block">Название<input required maxLength={160} name="name" className="mt-1 block w-full rounded border p-2" /></label>
        <label className="block">Описание<textarea name="description" maxLength={4000} className="mt-1 block w-full rounded border p-2" /></label>
        <p className="text-sm text-slate-500">Будут созданы стандартные этапы, которые можно отредактировать.</p>
      </PipelineForm>
    </section>}
  </div>;
}
