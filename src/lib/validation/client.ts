import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Максимум ${max} символов`)
    .transform((value) => (value === "" ? null : value));

export const clientIdSchema = z.string().uuid();

export const createClientSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, "Укажите имя")
    .max(120, "Имя слишком длинное"),

  lastName: optionalText(120),

  middleName: optionalText(120),

  phone: optionalText(50),

  email: z
    .string()
    .trim()
    .max(320, "Email слишком длинный")
    .refine(
      (value) =>
        value === "" ||
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
      "Некорректный email",
    )
    .transform((value) => (value === "" ? null : value)),

  status: z.enum([
    "active",
    "lead",
    "inactive",
  ]),

  source: optionalText(100),

  notes: optionalText(5000),
});

export const updateClientSchema =
  createClientSchema;

export type ClientFormInput = z.infer<
  typeof createClientSchema
>;

export type ClientFormState = {
  errors?: Partial<
    Record<keyof ClientFormInput, string[]>
  >;

  message?: string;

  values?: Record<string, string>;
};

export type CreateClientState =
  ClientFormState;

export type UpdateClientState =
  ClientFormState;