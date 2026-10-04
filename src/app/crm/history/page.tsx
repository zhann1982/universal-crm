import { notFound } from "next/navigation";
import { z } from "zod";
import Link from "@/components/app-link";
import { EntityTimeline } from "@/modules/activity/entity-timeline";
import { requirePermission } from "@/lib/auth/permissions";
import { getEntityReadPermission } from "@/modules/activity/entity-types";
import { getEntityTarget } from "@/modules/activity/entity-target";
export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; id?: string; cursor?: string }>;
}) {
  const parsed = z
    .object({
      type: z.enum(["client", "company", "deal", "task"]),
      id: z.uuid(),
      cursor: z.string().max(300).optional(),
    })
    .safeParse(await searchParams);
  if (!parsed.success) notFound();
  const { type, id, cursor } = parsed.data;
  const { organization } = await requirePermission(
    getEntityReadPermission(type),
  );
  const target = await getEntityTarget({
    organizationId: organization.id,
    entityType: type,
    entityId: id,
  });
  if (!target) notFound();
  const paths = {
    client: "clients",
    company: "companies",
    deal: "deals",
    task: "tasks",
  };
  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href={`/crm/${paths[type]}/${id}`}
        className="text-sm text-slate-500"
      >
        ← Вернуться к записи
      </Link>
      <h1 className="mt-4 text-3xl font-bold">История записи</h1>
      <EntityTimeline
        entityType={type}
        entityId={id}
        entityArchived={target.isArchived}
        cursor={cursor}
      />
    </div>
  );
}
