import Link from "next/link";
import { randomUUID } from "node:crypto";
import { readViews } from "./persistence";
import { filtersHref, parseFilters, type ViewEntity } from "./filters";
import { SavedViewForm } from "./form";
import { db } from "@/db";
import { pipelines } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export async function SavedViewsBar({ organizationId, memberId, entity, filters }: {
  organizationId: string; memberId: string; entity: ViewEntity; filters: Record<string,string>;
}) {
  const rows = await readViews(organizationId, memberId, entity);
  const available = entity === "deals" ? new Set((await db.select({id:pipelines.id}).from(pipelines).where(and(eq(pipelines.organizationId, organizationId),eq(pipelines.isArchived,false)))).map(p=>p.id)) : null;
  function href(value: unknown) {
    try {
      const parsed = parseFilters(entity,value);
      if (available && !available.has(parsed.pipeline)) return null;
      return filtersHref(entity,parsed);
    } catch { return null; }
  }
  return <section className="mb-6 space-y-3 rounded-xl border border-slate-200 bg-white p-5">
    <h2 className="font-semibold">Мои представления</h2>
    <p className="text-xs text-slate-500">Личные фильтры для этого раздела и организации. Сначала примените фильтры, затем сохраните представление.</p>
    <div className="flex flex-wrap gap-4">{rows.filter(r=>!r.is_archived).map(row=> {
      const target = href(row.filters);
      return <div key={row.id} className="flex items-center gap-2">
        {target ? <Link href={target} className="text-sm text-blue-600">{row.name}</Link> : <span className="text-sm text-slate-500">{row.name} · недоступно</span>}
        <SavedViewForm entity={entity} id={row.id} version={row.version} operation="archive" />
      </div>;
    })}</div>
    <SavedViewForm key={JSON.stringify(filters)} id={randomUUID()} entity={entity} filters={filters} />
    {rows.some(r=>r.is_archived) && <details><summary className="cursor-pointer text-sm">Архив представлений</summary>
      <div className="mt-3 space-y-2">{rows.filter(r=>r.is_archived).map(row=><div key={row.id} className="flex items-center gap-3"><span className="text-sm">{row.name}</span><SavedViewForm entity={entity} id={row.id} version={row.version} operation="restore" /></div>)}</div>
    </details>}
  </section>;
}
