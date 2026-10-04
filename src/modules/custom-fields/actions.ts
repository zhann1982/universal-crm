"use server";
import { fieldPermissions, canEditValues } from "./policy";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireMutationPermission } from "@/lib/auth/permissions";
import { definitionSchema, entitySchema } from "./validation";
import { manageDefinition, saveValues } from "./persistence";
export type FieldState = {
  message?: string;
  success?: boolean;
  savedVersion?: number;
};
export async function configureField(
  _state: FieldState,
  form: FormData,
): Promise<FieldState> {
  const { organization, member } = await requireMutationPermission(
    "settings.manage",
    form,
  );
  const operation = z
    .enum(["create", "update", "archive", "restore"])
    .safeParse(form.get("operation"));
  const data = definitionSchema.safeParse({
    entity: form.get("entity"),
    name: form.get("name"),
    type: form.get("type"),
    required: form.get("required") === "on",
    position: form.get("position"),
    options: String(form.get("options") ?? "")
      .split(/\r?\n/)
      .map((v) => v.trim())
      .filter(Boolean),
  });
  if (!operation.success || !data.success)
    return { message: "Проверьте название, тип, порядок и варианты поля." };
  const id = String(form.get("id") ?? "");
  const version = Number(form.get("version"));
  if (
    operation.data !== "create" &&
    (!z.uuid().safeParse(id).success ||
      !Number.isInteger(version) ||
      version < 1)
  )
    return { message: "Некорректная версия поля." };
  try {
    const changed = await manageDefinition({
      organizationId: organization.id,
      memberId: member.id,
      entity: data.data.entity,
      id: id || undefined,
      version,
      operation: operation.data,
      data: data.data,
    });
    if (!changed)
      return { message: "Поле изменилось или недоступно. Обновите страницу." };
  } catch {
    return {
      message:
        "Не удалось сохранить поле. Проверьте уникальность названия и лимит: 50 активных, 150 всего на раздел.",
    };
  }
  revalidatePath("/crm", "layout");
  return { success: true, message: "Настройка поля сохранена." };
}
export async function updateFieldValues(
  _state: FieldState,
  form: FormData,
): Promise<FieldState> {
  const entity = entitySchema.safeParse(form.get("entity"));
  if (!entity.success) return { message: "Некорректный раздел." };
  const { organization, member, permissions } = await requireMutationPermission(
    fieldPermissions[entity.data].update,
    form,
  );
  if (!canEditValues(entity.data, permissions))
    return { message: "Недостаточно прав для просмотра записи." };
  const input: Record<string, string> = {};
  for (const [key, value] of form)
    if (key.startsWith("custom:")) {
      if (typeof value !== "string" || Object.hasOwn(input, key.slice(7)))
        return { message: "Некорректные значения полей." };
      input[key.slice(7)] = value;
    }
  let savedVersion: number | null;
  try {
    const changed = await saveValues({
      organizationId: organization.id,
      memberId: member.id,
      entity: entity.data,
      id: String(form.get("id")),
      version: Number(form.get("version")),
      revision: Number(form.get("customFieldSchema")),
      input,
    });
    savedVersion = changed;
    if (!changed)
      return {
        message:
          "Запись изменилась, архивирована или недоступна. Обновите страницу; черновик сохранён в форме.",
      };
  } catch (error) {
    const known =
      error instanceof Error &&
      !("code" in error) &&
      /^(Заполните поле|Поле «|Настройка полей|Неизвестное поле)/.test(
        error.message,
      );
    return {
      message: known
        ? error.message
        : "Не удалось сохранить поля. Обновите страницу и проверьте значения.",
    };
  }
  revalidatePath("/crm", "layout");
  return {
    success: true,
    savedVersion: savedVersion!,
    message: "Значения полей сохранены.",
  };
}
