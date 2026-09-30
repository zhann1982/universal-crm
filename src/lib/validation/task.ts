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
    value === "" ? null : value,
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

export const taskRecurrenceFrequencySchema =
  z.enum([
    "none",
    "daily",
    "weekly",
    "monthly",
    "yearly",
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

export const taskScheduleVersionSchema =
  z.coerce
    .number()
    .int()
    .min(
      1,
      "Некорректная версия планирования",
    );

const taskFormSchema = z
  .object({
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

    reminderAt:
      optionalIsoDateTime,

    recurrenceFrequency:
      taskRecurrenceFrequencySchema,

    recurrenceInterval: z.coerce
      .number()
      .int()
      .min(
        1,
        "Минимальный интервал — 1",
      )
      .max(
        365,
        "Слишком большой интервал",
      ),

    recurrenceEndAt:
      optionalIsoDateTime,

    ownerMemberId:
      optionalUuid,

    clientId:
      optionalUuid,

    companyId:
      optionalUuid,

    dealId:
      optionalUuid,
  })
  .superRefine((data, ctx) => {
    if (
      data.reminderAt &&
      data.dueAt &&
      data.reminderAt.getTime() >
        data.dueAt.getTime()
    ) {
      ctx.addIssue({
        code:
          "custom",
        path: [
          "reminderAt",
        ],
        message:
          "Напоминание должно быть не позже срока выполнения",
      });
    }

    if (
      data.recurrenceFrequency !==
        "none" &&
      (data.status === "completed" ||
        data.status === "cancelled")
    ) {
      ctx.addIssue({
        code:
          "custom",
        path: [
          "recurrenceFrequency",
        ],
        message:
          "Повтор можно настроить только для активной задачи",
      });
    }

    if (
      data.recurrenceFrequency !==
        "none" &&
      !data.dueAt
    ) {
      ctx.addIssue({
        code:
          "custom",
        path: ["dueAt"],
        message:
          "Для повторяющейся задачи укажите срок выполнения",
      });
    }

    if (
      data.recurrenceFrequency ===
        "none" &&
      data.recurrenceEndAt
    ) {
      ctx.addIssue({
        code:
          "custom",
        path: [
          "recurrenceEndAt",
        ],
        message:
          "Сначала выберите повтор задачи",
      });
    }

    if (
      data.recurrenceEndAt &&
      data.dueAt &&
      data.recurrenceEndAt.getTime() <=
        data.dueAt.getTime()
    ) {
      ctx.addIssue({
        code:
          "custom",
        path: [
          "recurrenceEndAt",
        ],
        message:
          "Дата окончания повторов должна быть позже первого срока",
      });
    }
  });

export const createTaskSchema =
  taskFormSchema;

export const updateTaskSchema =
  taskFormSchema;

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
        "reminders",
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

    sort: z
      .enum([
        "created_desc",
        "created_asc",
        "due_asc",
        "due_desc",
        "priority_desc",
        "priority_asc",
        "title_asc",
        "title_desc",
      ])
      .catch("created_desc"),

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
