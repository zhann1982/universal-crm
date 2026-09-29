"use client";

import {
  useActionState,
  useState,
} from "react";

import {
  createTask,
} from "../actions";
import type {
  CreateTaskState,
} from "@/lib/validation/task";

const initialState:
  CreateTaskState = {};

type Option = {
  id: string;
  label: string;
};

type TaskFormProps = {
  members: Option[];
  clients: Option[];
  companies: Option[];
  deals: Option[];
  defaultOwnerMemberId: string;
  defaultClientId?: string;
  defaultCompanyId?: string;
  defaultDealId?: string;
};

export function TaskForm({
  members,
  clients,
  companies,
  deals,
  defaultOwnerMemberId,
  defaultClientId = "",
  defaultCompanyId = "",
  defaultDealId = "",
}: TaskFormProps) {
  const [state, formAction, pending] =
    useActionState(
      createTask,
      initialState,
    );

  const [dueAtIso, setDueAtIso] =
    useState(
      state.values?.dueAt ?? "",
    );

  const dueAtLocal =
    isoToLocalInput(
      state.values?.dueAt,
    );

  return (
    <form
      action={formAction}
      className="space-y-8"
    >
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
              placeholder="Например: Позвонить клиенту"
              defaultValue={
                state.values?.title
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
              "todo"
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
              "normal"
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
              htmlFor="dueAtLocal"
              className="mb-2 block text-sm font-medium"
            >
              Срок выполнения
            </label>

            <input
              key={dueAtLocal}
              id="dueAtLocal"
              type="datetime-local"
              defaultValue={
                dueAtLocal
              }
              onChange={(event) => {
                const value =
                  event.target.value;

                setDueAtIso(
                  value
                    ? new Date(
                        value,
                      ).toISOString()
                    : "",
                );
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none transition focus:border-slate-500"
            />

            <input
              type="hidden"
              name="dueAt"
              value={dueAtIso}
            />

            <p className="mt-2 text-xs text-slate-500">
              Время сохраняется как
              точный момент и учитывает
              часовой пояс браузера.
            </p>

            <FieldErrors
              errors={
                state.errors?.dueAt
              }
            />
          </div>

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
                defaultOwnerMemberId
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
                ?.description ?? ""
            }
            placeholder="Что нужно сделать?"
            className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2.5 outline-none transition focus:border-slate-500"
          />

          <FieldErrors
            errors={
              state.errors?.description
            }
          />
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">
          Связи CRM
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Все связи необязательны.
        </p>

        <div className="mt-6 grid gap-6 md:grid-cols-3">
          <ReferenceSelect
            label="Клиент"
            name="clientId"
            emptyLabel="Без клиента"
            options={clients}
            defaultValue={
              state.values?.clientId ??
              defaultClientId
            }
            errors={
              state.errors?.clientId
            }
          />

          <ReferenceSelect
            label="Компания"
            name="companyId"
            emptyLabel="Без компании"
            options={companies}
            defaultValue={
              state.values?.companyId ??
              defaultCompanyId
            }
            errors={
              state.errors?.companyId
            }
          />

          <ReferenceSelect
            label="Сделка"
            name="dealId"
            emptyLabel="Без сделки"
            options={deals}
            defaultValue={
              state.values?.dealId ??
              defaultDealId
            }
            errors={
              state.errors?.dealId
            }
          />
        </div>
      </section>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-slate-950 px-6 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending
            ? "Сохранение..."
            : "Создать задачу"}
        </button>
      </div>
    </form>
  );
}

type FieldProps = {
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
  defaultValue?: string;
  errors?: string[];
};

function Field({
  label,
  name,
  placeholder,
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
        placeholder={placeholder}
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

function isoToLocalInput(
  value?: string,
) {
  if (!value) {
    return "";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "";
  }

  const localDate =
    new Date(
      date.getTime() -
        date.getTimezoneOffset() *
          60_000,
    );

  return localDate
    .toISOString()
    .slice(0, 16);
}
