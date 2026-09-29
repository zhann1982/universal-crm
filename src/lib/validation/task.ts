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

const isoDateTimePattern =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

const optionalIsoDateTime = z
  .string()
  .trim()
  .refine(
    (value) => {
      if (value === "") {
        return true;
      }

      if (
        !isoDateTimePattern.test(
          value,
        )
      ) {
        return false;
      }

      return !Number.isNaN(
        new Date(value).getTime(),
      );
    },
    "Некорректные дата и время",
  )
  .transform((value) =>
    value === ""
      ? null
      : new Date(value),
  );

export const taskStatusSchema =
  z.enum([
    "todo",
    "in_progress",
    "completed",
    "cancelled",
  ]);

export const taskPrioritySchema =
  z.enum([
    "low",
    "normal",
    "high",
    "urgent",
  ]);

export const taskIdSchema =
  z.string().uuid();

export const taskVersionSchema =
  z.coerce
    .number()
    .int()
    .min(
      1,
      "Некорректная версия задачи",
    );

export const createTaskSchema =
  z.object({
    title: z
      .string()
      .trim()
      .min(
        1,
        "Укажите название задачи",
      )
      .max(
        240,
        "Название слишком длинное",
      ),

    description: z
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

    status:
      taskStatusSchema,

    priority:
      taskPrioritySchema,

    dueAt:
      optionalIsoDateTime,

    ownerMemberId:
      optionalUuid,

    clientId:
      optionalUuid,

    companyId:
      optionalUuid,

    dealId:
      optionalUuid,
  });

export const updateTaskSchema =
  createTaskSchema;

export type TaskFormInput =
  z.infer<
    typeof createTaskSchema
  >;

export type CreateTaskState = {
  errors?: Partial<
    Record<
      keyof TaskFormInput,
      string[]
    >
  >;

  message?: string;

  values?: Record<
    string,
    string
  >;
};

export type UpdateTaskState =
  CreateTaskState;

export const taskListQuerySchema =
  z.object({
    view: z
      .enum([
        "all",
        "mine",
        "overdue",
        "upcoming",
        "completed",
        "archive",
      ])
      .catch("all"),

    status: z
      .enum([
        "any",
        "todo",
        "in_progress",
        "completed",
        "cancelled",
      ])
      .catch("any"),

    priority: z
      .enum([
        "any",
        "low",
        "normal",
        "high",
        "urgent",
      ])
      .catch("any"),

    due: z
      .enum([
        "any",
        "overdue",
        "upcoming",
        "none",
      ])
      .catch("any"),

    owner: z
      .union([
        z.enum([
          "any",
          "mine",
          "unassigned",
        ]),
        z.string().uuid(),
      ])
      .catch("any"),

    q: z
      .string()
      .trim()
      .max(100)
      .catch(""),

    page: z.coerce
      .number()
      .int()
      .min(1)
      .catch(1),
  });

export type TaskListQuery =
  z.infer<
    typeof taskListQuerySchema
  >;
