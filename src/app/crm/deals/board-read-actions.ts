"use server";
import { z } from "zod";
import { getCurrentAccessContext } from "@/lib/auth/permissions";
import { dealFilters } from "@/modules/saved-views/filters";
import { boardCursor, readBoardColumn } from "@/modules/deals/read-board";
export async function loadBoardColumn(input: unknown) {
  const parsed = z
    .object({
      organizationId: z.uuid(),
      filters: dealFilters,
      stageId: z.uuid(),
      cursor: boardCursor,
    })
    .safeParse(input);
  if (!parsed.success) return null;
  const { organization, member, permissions } = await getCurrentAccessContext();
  if (
    parsed.data.organizationId !== organization.id ||
    !permissions.has("deals.read") ||
    !permissions.has("pipelines.read")
  )
    return null;
  return readBoardColumn(
    {
      organizationId: organization.id,
      memberId: member.id,
      memberDisplayName: member.displayName,
      permissions,
    },
    parsed.data.filters,
    parsed.data.stageId,
    parsed.data.cursor,
  );
}
