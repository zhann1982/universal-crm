import { z } from "zod";

const optionalUuid = z
  .string()
  .trim()
  .refine(
    (value) =>
      value === "" ||
      z.string().uuid().safeParse(value)
        .success,
    "Некорректный идентификатор",
  )
  .transform((value) =>
    value === "" ? null : value,
  );

const amountSchema = z
  .string()
  .trim()
  .transform((value) =>
    value
      .replace(/\s+/g, "")
      .replace(",", "."),
  )
  .refine(
    (value) =>
      value === "" ||
      /^\d{1,12}(\.\d{1,2})?$/.test(
        value,
      ),
    "Укажите корректную сумму, максимум 2 знака после запятой",
  )
  .transform((value) =>
    value === "" ? null : value,
  );

const currencySchema = z
  .string()
  .trim()
  .toUpperCase()
  .refine(
    (value) =>
      value === "" ||
      /^[A-Z]{3}$/.test(value),
    "Используйте трёхбуквенный код валюты, например KZT",
  )
  .transform((value) =>
    value === "" ? null : value,
  );

const optionalDate = z
  .string()
  .trim()
  .refine(
    (value) => {
      if (value === "") {
        return true;
      }

      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(
          value,
        )
      ) {
        return false;
      }

      return !Number.isNaN(
        Date.parse(
          `${value}T12:00:00.000Z`,
        ),
      );
    },
    "Некорректная дата",
  )
  .transform((value) =>
    value === "" ? null : value,
  );

export const dealIdSchema =
  z.string().uuid();

export const createDealSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(
        1,
        "Укажите название сделки",
      )
      .max(
        240,
        "Название слишком длинное",
      ),

    pipelineId:
      z.string().uuid(
        "Выберите воронку",
      ),

    stageId:
      z.string().uuid(
        "Выберите этап",
      ),

    amount:
      amountSchema,

    currency:
      currencySchema,

    companyId:
      optionalUuid,

    ownerMemberId:
      optionalUuid,

    expectedCloseAt:
      optionalDate,

    notes: z
      .string()
      .trim()
      .max(
        5000,
        "Максимум 5000 символов",
      )
      .transform((value) =>
        value === ""
          ? null
          : value,
      ),
  })
  .superRefine(
    (data, ctx) => {
      if (
        data.amount &&
        !data.currency
      ) {
        ctx.addIssue({
          code:
            "custom",
          path: [
            "currency",
          ],
          message:
            "Для суммы укажите валюту",
        });
      }
    },
  );

export type DealFormInput =
  z.infer<
    typeof createDealSchema
  >;

export type CreateDealState = {
  errors?: Partial<
    Record<
      keyof DealFormInput,
      string[]
    >
  >;

  message?: string;

  values?: Record<
    string,
    string
  >;
};

export const updateDealSchema =
  createDealSchema;

export type UpdateDealState =
  CreateDealState;