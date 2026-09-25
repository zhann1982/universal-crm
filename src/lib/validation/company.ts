import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(
      max,
      `Максимум ${max} символов`,
    )
    .transform((value) =>
      value === ""
        ? null
        : value,
    );

const optionalEmail = z
  .string()
  .trim()
  .max(
    320,
    "Email слишком длинный",
  )
  .refine(
    (value) =>
      value === "" ||
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        value,
      ),
    "Некорректный email",
  )
  .transform((value) =>
    value === ""
      ? null
      : value,
  );

const optionalMemberId = z
  .string()
  .trim()
  .refine(
    (value) =>
      value === "" ||
      z
        .string()
        .uuid()
        .safeParse(value)
        .success,
    "Некорректный сотрудник",
  )
  .transform((value) =>
    value === ""
      ? null
      : value,
  );

export const companyIdSchema =
  z.string().uuid();

export const createCompanySchema =
  z.object({
    name: z
      .string()
      .trim()
      .min(
        1,
        "Укажите название компании",
      )
      .max(
        200,
        "Название слишком длинное",
      ),

    legalName:
      optionalText(300),

    taxId:
      optionalText(100),

    phone:
      optionalText(50),

    email:
      optionalEmail,

    website:
      optionalText(500),

    industry:
      optionalText(160),

    address:
      optionalText(2000),

    status: z.enum([
      "active",
      "prospect",
      "inactive",
    ]),

    ownerMemberId:
      optionalMemberId,

    notes:
      optionalText(5000),
  });

export const updateCompanySchema =
  createCompanySchema;

export const companyListQuerySchema =
  z.object({
    q: z
      .string()
      .trim()
      .max(160)
      .catch(""),

    status: z
      .enum([
        "all",
        "active",
        "prospect",
        "inactive",
      ])
      .catch("all"),

    view: z
      .enum([
        "active",
        "archive",
      ])
      .catch("active"),

    page: z
      .coerce
      .number()
      .int()
      .min(1)
      .catch(1),
  });

export type CompanyFormInput =
  z.infer<
    typeof createCompanySchema
  >;

export type CompanyFormState = {
  errors?: Partial<
    Record<
      keyof CompanyFormInput,
      string[]
    >
  >;

  message?: string;

  values?: Record<
    string,
    string
  >;
};

export type CreateCompanyState =
  CompanyFormState;

export type UpdateCompanyState =
  CompanyFormState;

export type CompanyListQuery =
  z.infer<
    typeof companyListQuerySchema
  >;