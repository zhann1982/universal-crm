"use server";

import { revalidatePath } from "next/cache";
import { requireMutationPermission } from "@/lib/auth/permissions";
import { managePipeline, pipelineMutation } from "@/modules/pipelines/manage-pipeline";

export type PipelineState = { error?: string; success?: string };

export async function submitPipeline(_previous: PipelineState, form: FormData): Promise<PipelineState> {
  const context = await requireMutationPermission("pipelines.manage", form);
  const parsed = pipelineMutation.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Проверьте название, тип, вероятность, порядок и цвет этапа." };
  try {
    const id = await managePipeline(context.organization.id, parsed.data);
    if (!id) return { error: "Воронка изменилась или операция недоступна. Обновите страницу. Нельзя архивировать основную воронку или воронку с активными сделками; менять тип используемого этапа." };
    revalidatePath("/crm", "layout");
    return { success: "Изменения сохранены." };
  } catch (error) {
    if ((error as { code?: string }).code === "23505") return { error: "Название воронки, название этапа или его порядок уже заняты." };
    console.error("Pipeline configuration failed", error);
    return { error: "Не удалось сохранить изменения. Обновите страницу и повторите попытку." };
  }
}
