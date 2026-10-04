"use server";

import { revalidatePath } from "next/cache";
import { requireMutationPermission } from "@/lib/auth/permissions";
import { savedViewDraft, saveView } from "./persistence";
import { viewEntity } from "./filters";

export async function submitSavedView(_state: { message?: string; success?: boolean }, form: FormData): Promise<{ message?: string; success?: boolean }> {
  const entity = viewEntity.safeParse(form.get("entity"));
  if (!entity.success) return { message: "Неизвестный раздел." };
  const { organization, member, permissions } = await requireMutationPermission(`${entity.data}.read`, form);
  if (entity.data === "deals" && !permissions.has("pipelines.read")) return { message: "Нет доступа к воронкам." };
  try {
    const raw = Object.fromEntries(form);
    const draft = savedViewDraft.parse({ ...raw, filters: raw.filters ? JSON.parse(String(raw.filters)) : undefined });
    const result = await saveView(organization.id, member.id, draft);
    if (!result) return { message: "Представление изменилось, недоступно или достигнут лимит 50. Обновите страницу." };
    revalidatePath(`/crm/${entity.data}`);
    return { success: true, message: draft.operation === "archive" ? "Представление перемещено в архив." : draft.operation === "restore" ? "Представление восстановлено." : "Представление сохранено." };
  } catch (error) {
    const failure = error as { code?: string; cause?: { code?: string } };
    if ((failure.code ?? failure.cause?.code) === "23505") return { message: "Представление с таким названием уже существует." };
    return { message: "Не удалось сохранить представление. Проверьте название и фильтры." };
  }
}
