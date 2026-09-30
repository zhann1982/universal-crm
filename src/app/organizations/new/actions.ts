"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireVerifiedSession } from "@/lib/auth/verified-session";
import { ORGANIZATION_COOKIE } from "@/modules/access/organization-selection";
import { createOrganization, organizationDraft } from "@/modules/organizations/create-organization";

export type CreationState = { error: string | null };

export async function submitOrganization(_state: CreationState, formData: FormData): Promise<CreationState> {
  const session = await requireVerifiedSession();
  const draft = organizationDraft.safeParse({ name: formData.get("name"), requestId: formData.get("requestId") });
  if (!draft.success) return { error: draft.error.issues[0]?.message ?? "Проверьте данные формы" };
  let organizationId: string | null;
  try {
    const result = await createOrganization(session.user.id, draft.data);
    organizationId = result.organizationId;
    if (!organizationId) return { error: "Организация недоступна или email больше не подтверждён. Обновите страницу." };
  } catch (error) {
    console.error("Organization creation failed", error);
    return { error: "Не удалось создать организацию. Попробуйте отправить эту форму ещё раз." };
  }
  (await cookies()).set(ORGANIZATION_COOKIE, organizationId, {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30,
  });
  revalidatePath("/crm", "layout");
  redirect("/crm");
}
