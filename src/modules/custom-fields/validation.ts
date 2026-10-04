import { z } from "zod";

export const entitySchema = z.enum(["client", "company", "deal"]);
export type FieldEntity = z.infer<typeof entitySchema>;
export const definitionSchema = z
  .object({
    entity: entitySchema,
    name: z.string().trim().min(1).max(80),
    type: z.enum(["text", "number", "date", "boolean", "select"]),
    required: z.boolean(),
    position: z.coerce.number().int().min(0).max(999),
    options: z.array(z.string().trim().min(1).max(80)).max(30),
  })
  .superRefine((v, ctx) => {
    if (
      v.type === "select" &&
      (!v.options.length || new Set(v.options).size !== v.options.length)
    )
      ctx.addIssue({
        code: "custom",
        message: "Укажите уникальные варианты списка.",
      });
    if (v.type !== "select" && v.options.length)
      ctx.addIssue({
        code: "custom",
        message: "Варианты разрешены только для списка.",
      });
  });
export type FieldDefinition = z.infer<typeof definitionSchema> & {
  id: string;
  version: number;
  archived: boolean;
};
export function validateValues(
  fields: FieldDefinition[],
  input: Record<string, string>,
  existing: Record<string, string> = {},
) {
  const result: Record<string, string> = { ...existing };
  for (const key of Object.keys(input))
    if (!fields.some((f) => f.id === key && !f.archived))
      throw new Error("Неизвестное поле. Обновите страницу.");
  for (const f of fields.filter((f) => !f.archived)) {
    const value = (input[f.id] ?? "").trim();
    if (!value) {
      if (f.required) throw new Error(`Заполните поле «${f.name}».`);
      delete result[f.id];
      continue;
    }
    if (value.length > 2000)
      throw new Error(`Поле «${f.name}»: максимум 2000 символов.`);
    if (f.type === "number" && !/^-?\d{1,12}(\.\d{1,6})?$/.test(value))
      throw new Error(`Поле «${f.name}»: укажите число.`);
    if (f.type === "boolean" && !["true", "false"].includes(value))
      throw new Error(`Поле «${f.name}»: выберите да или нет.`);
    if (f.type === "select" && !f.options.includes(value))
      throw new Error(`Поле «${f.name}»: выберите вариант списка.`);
    if (f.type === "date") {
      const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
      if (
        !parts ||
        +parts[1] < 1 ||
        +parts[2] < 1 ||
        +parts[2] > 12 ||
        +parts[3] < 1 ||
        +parts[3] > new Date(Date.UTC(+parts[1], +parts[2], 0)).getUTCDate()
      )
        throw new Error(`Поле «${f.name}»: укажите существующую дату.`);
    }
    result[f.id] = value;
  }
  return result;
}
