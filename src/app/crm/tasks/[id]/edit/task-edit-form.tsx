"use client";

import { useToastActionState } from "@/modules/notifications/use-toast-action-state";

import { OrganizationForm } from "@/modules/access/organization-context";


import Link from "@/components/app-link";


import {
  updateTask,
} from "../../actions";
import type {
  UpdateTaskState,
} from "@/lib/validation/task";
import {
  TaskScheduleFields,
} from "../../task-schedule-fields";

type Option = {
  id: string;
  label: string;
};

type EditableTask = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueAt: string | null;
  reminderAt: string | null;
  recurrenceFrequency: string;
  recurrenceInterval: number;
  recurrenceEndAt: string | null;
  ownerMemberId: string | null;
  clientId: string | null;
  companyId: string | null;
  dealId: string | null;
  version: number;
};

type TaskEditFormProps = {
  task: EditableTask;
  members: Option[];
  clients: Option[];
  companies: Option[];
  deals: Option[];
  canEditClients: boolean;
  canEditCompanies: boolean;
  canEditDeals: boolean;
};

const initialState:
  UpdateTaskState = {};

export function TaskEditForm({
  task,
  members,
  clients,
  companies,
  deals,
  canEditClients,
  canEditCompanies,
  canEditDeals,
}: TaskEditFormProps) {
  const [state, formAction, pending] =
    useToastActionState(
      updateTask,
      initialState,
    );

  return (
    <OrganizationForm
      action={formAction}
      className="space-y-8"
    >
      <input
        type="hidden"
        name="taskId"
        value={task.id}
      />

      <input
        type="hidden"
        name="version"
        value={task.version}
      />

      {state.message && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.message}
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">
          Основная информация
        </h2>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div className="md:col-span-2">
            <Field
              label="Название"
              name="title"
              required
              defaultValue={
                state.values?.title ??
                task.title
              }
              errors={
                state.errors?.title
              }
            />
          </div>

          <SelectField
            label="Статус"
            name="status"
            defaultValue={
              state.values?.status ??
              task.status
            }
            errors={
              state.errors?.status
            }
            options={[
              {
                value: "todo",
                label: "К выполнению",
              },
              {
                value: "in_progress",
                label: "В работе",
              },
              {
                value: "completed",
                label: "Выполнена",
              },
              {
                value: "cancelled",
                label: "Отменена",
              },
            ]}
          />

          <SelectField
            label="Приоритет"
            name="priority"
            defaultValue={
              state.values?.priority ??
              task.priority
            }
            errors={
              state.errors?.priority
            }
            options={[
              {
                value: "low",
                label: "Низкий",
              },
              {
                value: "normal",
                label: "Обычный",
              },
              {
                value: "high",
                label: "Высокий",
              },
              {
                value: "urgent",
                label: "Срочный",
              },
            ]}
          />

          <div>
            <label
              htmlFor="ownerMemberId"
              className="mb-2 block text-sm font-medium"
            >
              Ответственный
            </label>

            <select
              id="ownerMemberId"
              name="ownerMemberId"
              defaultValue={
                state.values
                  ?.ownerMemberId ??
                task.ownerMemberId ??
                ""
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-slate-500"
            >
              <option value="">
                Без ответственного
              </option>

              {members.map(
                (member) => (
                  <option
                    key={member.id}
                    value={member.id}
                  >
                    {member.label}
                  </option>
                ),
              )}
            </select>

            <FieldErrors
              errors={
                state.errors
                  ?.ownerMemberId
              }
            />
          </div>
        </div>

        <div className="mt-6">
          <label
            htmlFor="description"
            className="mb-2 block text-sm font-medium"
          >
            Описание
          </label>

          <textarea
            id="description"
            name="description"
            rows={6}
            defaultValue={
              state.values
                ?.description ??
              task.description ??
              ""
            }
            className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2.5 outline-none transition focus:border-slate-500"
          />

          <FieldErrors
            errors={
              state.errors?.description
            }
          />
        </div>
      </section>

      <TaskScheduleFields
        key={[
          state.values?.dueAt ?? task.dueAt ?? "",
          state.values?.reminderAt ?? task.reminderAt ?? "",
          state.values?.recurrenceFrequency ?? task.recurrenceFrequency,
          state.values?.recurrenceInterval ?? String(task.recurrenceInterval),
          state.values?.recurrenceEndAt ?? task.recurrenceEndAt ?? "",
        ].join("|")}
        dueAt={state.values?.dueAt ?? task.dueAt ?? ""}
        reminderAt={state.values?.reminderAt ?? task.reminderAt ?? ""}
        recurrenceFrequency={state.values?.recurrenceFrequency ?? task.recurrenceFrequency}
        recurrenceInterval={state.values?.recurrenceInterval ?? String(task.recurrenceInterval)}
        recurrenceEndAt={state.values?.recurrenceEndAt ?? task.recurrenceEndAt ?? ""}
        errors={{
          dueAt: state.errors?.dueAt,
          reminderAt: state.errors?.reminderAt,
          recurrenceFrequency: state.errors?.recurrenceFrequency,
          recurrenceInterval: state.errors?.recurrenceInterval,
          recurrenceEndAt: state.errors?.recurrenceEndAt,
        }}
      />

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">
          Связи CRM
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Изменение связи доступно
          только при наличии права
          чтения соответствующего
          модуля.
        </p>

        <div className="mt-6 grid gap-6 md:grid-cols-3">
          {canEditClients ? (
            <ReferenceSelect
              label="Клиент"
              name="clientId"
              emptyLabel="Без клиента"
              options={clients}
              defaultValue={
                state.values?.clientId ??
                task.clientId ??
                ""
              }
              errors={
                state.errors?.clientId
              }
            />
          ) : (
            <LockedRelation
              label="Клиент"
              hasRelation={
                Boolean(task.clientId)
              }
            />
          )}

          {canEditCompanies ? (
            <ReferenceSelect
              label="Компания"
              name="companyId"
              emptyLabel="Без компании"
              options={companies}
              defaultValue={
                state.values
                  ?.companyId ??
                task.companyId ??
                ""
              }
              errors={
                state.errors?.companyId
              }
            />
          ) : (
            <LockedRelation
              label="Компания"
              hasRelation={
                Boolean(task.companyId)
              }
            />
          )}

          {canEditDeals ? (
            <ReferenceSelect
              label="Сделка"
              name="dealId"
              emptyLabel="Без сделки"
              options={deals}
              defaultValue={
                state.values?.dealId ??
                task.dealId ??
                ""
              }
              errors={
                state.errors?.dealId
              }
            />
          ) : (
            <LockedRelation
              label="Сделка"
              hasRelation={
                Boolean(task.dealId)
              }
            />
          )}
        </div>
      </section>

      <div className="flex flex-wrap justify-end gap-3">
        <Link
          href={`/crm/tasks/${task.id}`}
          className="rounded-lg border border-slate-300 bg-white px-6 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Отмена
        </Link>

        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-slate-950 px-6 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending
            ? "Сохранение..."
            : "Сохранить изменения"}
        </button>
      </div>
    </OrganizationForm>
  );
}

type FieldProps = {
  label: string;
  name: string;
  required?: boolean;
  defaultValue?: string;
  errors?: string[];
};

function Field({
  label,
  name,
  required,
  defaultValue,
  errors,
}: FieldProps) {
  return (
    <div>
      <label
        htmlFor={name}
        className="mb-2 block text-sm font-medium"
      >
        {label}

        {required && (
          <span className="ml-1 text-red-500">
            *
          </span>
        )}
      </label>

      <input
        id={name}
        name={name}
        required={required}
        defaultValue={
          defaultValue ?? ""
        }
        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none transition focus:border-slate-500"
      />

      <FieldErrors errors={errors} />
    </div>
  );
}

type SelectOption = {
  value: string;
  label: string;
};

function SelectField({
  label,
  name,
  options,
  defaultValue,
  errors,
}: {
  label: string;
  name: string;
  options: SelectOption[];
  defaultValue: string;
  errors?: string[];
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="mb-2 block text-sm font-medium"
      >
        {label}
      </label>

      <select
        id={name}
        name={name}
        defaultValue={defaultValue}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-slate-500"
      >
        {options.map(
          (option) => (
            <option
              key={option.value}
              value={option.value}
            >
              {option.label}
            </option>
          ),
        )}
      </select>

      <FieldErrors errors={errors} />
    </div>
  );
}

function ReferenceSelect({
  label,
  name,
  emptyLabel,
  options,
  defaultValue,
  errors,
}: {
  label: string;
  name: string;
  emptyLabel: string;
  options: Option[];
  defaultValue?: string;
  errors?: string[];
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="mb-2 block text-sm font-medium"
      >
        {label}
      </label>

      <select
        id={name}
        name={name}
        defaultValue={
          defaultValue ?? ""
        }
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-slate-500"
      >
        <option value="">
          {emptyLabel}
        </option>

        {options.map(
          (option) => (
            <option
              key={option.id}
              value={option.id}
            >
              {option.label}
            </option>
          ),
        )}
      </select>

      <FieldErrors errors={errors} />
    </div>
  );
}

function LockedRelation({
  label,
  hasRelation,
}: {
  label: string;
  hasRelation: boolean;
}) {
  return (
    <div>
      <div className="mb-2 text-sm font-medium">
        {label}
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-500">
        {hasRelation
          ? "Текущая связь сохранится"
          : "Нет доступа для выбора"}
      </div>
    </div>
  );
}

function FieldErrors({
  errors,
}: {
  errors?: string[];
}) {
  if (!errors?.length) {
    return null;
  }

  return (
    <div className="mt-2 space-y-1">
      {errors.map((error) => (
        <p
          key={error}
          className="text-sm text-red-600"
        >
          {error}
        </p>
      ))}
    </div>
  );
}
