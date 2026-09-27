import { z } from "zod";

const optionalUuid = z
  .string()
  .trim()
  .refine(
    (value) =>
      value === "" ||
      z.string().uuid().safeParse(
        value,
      ).success,
    "Некорректный идентификатор",
  )
  .transform((value) =>
    value === ""
      ? null
      : value,
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
    value === ""
      ? null
      : value,
  );

const currencySchema = z
  .string()
  .trim()
  .toUpperCase()
  .refine(
    (value) =>
      value === "" ||
      /^[A-Z]{3}$/.test(
        value,
      ),
    "Используйте трёхбуквенный код валюты, например KZT",
  )
  .transform((value) =>
    value === ""
      ? null
      : value,
  );

/*
 * Строгая проверка календарной
 * даты в формате YYYY-MM-DD.
 *
 * В отличие от Date.parse(),
 * функция не нормализует:
 *
 * 2026-02-31
 * 2026-04-31
 * 2026-02-29
 *
 * в соседний месяц.
 */
export function isStrictIsoCalendarDate(
  value: string,
) {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      value,
    );

  if (!match) {
    return false;
  }

  const year =
    Number(match[1]);

  const month =
    Number(match[2]);

  const day =
    Number(match[3]);

  /*
   * Для текущей CRM не принимаем
   * условный ISO-год 0000.
   */
  if (
    year < 1 ||
    month < 1 ||
    month > 12 ||
    day < 1
  ) {
    return false;
  }

  const isLeapYear =
    year % 4 === 0 &&
    (
      year % 100 !== 0 ||
      year % 400 === 0
    );

  const daysInMonth = [
    31,
    isLeapYear
      ? 29
      : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];

  return (
    day <=
    daysInMonth[
      month - 1
    ]
  );
}

const optionalDate = z
  .string()
  .trim()
  .refine(
    (value) =>
      value === "" ||
      isStrictIsoCalendarDate(
        value,
      ),
    "Некорректная дата",
  )
  .transform((value) =>
    value === ""
      ? null
      : value,
  );

export const dealIdSchema =
  z.string().uuid();

/*
 * Используется для optimistic locking.
 *
 * Каждая Deal начинает с version = 1.
 * Каждая успешная мутация должна
 * увеличивать version.
 */
export const dealVersionSchema =
  z.coerce
    .number()
    .int()
    .min(
      1,
      "Некорректная версия сделки",
    );

export const createDealSchema =
  z
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
        .transform(
          (value) =>
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