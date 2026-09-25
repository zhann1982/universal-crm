"use client";

import { useActionState } from "react";

import { createClient } from "../actions";
import type { CreateClientState } from "@/lib/validation/client";

const initialState: CreateClientState = {};

export function ClientForm() {
  const [state, formAction, pending] =
    useActionState(
      createClient,
      initialState,
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
          <Field
            label="Имя"
            name="firstName"
            required
            defaultValue={
              state.values?.firstName
            }
            errors={
              state.errors?.firstName
            }
          />

          <Field
            label="Фамилия"
            name="lastName"
            defaultValue={
              state.values?.lastName
            }
            errors={
              state.errors?.lastName
            }
          />

          <Field
            label="Отчество"
            name="middleName"
            defaultValue={
              state.values?.middleName
            }
            errors={
              state.errors?.middleName
            }
          />

          <div>
            <label
              htmlFor="status"
              className="mb-2 block text-sm font-medium"
            >
              Статус
            </label>

            <select
              id="status"
              name="status"
              defaultValue={
                state.values?.status ??
                "active"
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-slate-500"
            >
              <option value="active">
                Активный
              </option>

              <option value="lead">
                Лид
              </option>

              <option value="inactive">
                Неактивный
              </option>
            </select>

            <FieldErrors
              errors={state.errors?.status}
            />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">
          Контакты
        </h2>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <Field
            label="Телефон"
            name="phone"
            type="tel"
            placeholder="+7 777 123 45 67"
            defaultValue={
              state.values?.phone
            }
            errors={
              state.errors?.phone
            }
          />

          <Field
            label="Email"
            name="email"
            type="email"
            placeholder="client@example.com"
            defaultValue={
              state.values?.email
            }
            errors={
              state.errors?.email
            }
          />
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">
          Дополнительно
        </h2>

        <div className="mt-6">
          <Field
            label="Источник"
            name="source"
            placeholder="Сайт, рекомендация, реклама..."
            defaultValue={
              state.values?.source
            }
            errors={
              state.errors?.source
            }
          />
        </div>

        <div className="mt-6">
          <label
            htmlFor="notes"
            className="mb-2 block text-sm font-medium"
          >
            Заметки
          </label>

          <textarea
            id="notes"
            name="notes"
            rows={5}
            defaultValue={
              state.values?.notes ?? ""
            }
            className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2.5 outline-none transition focus:border-slate-500"
            placeholder="Дополнительная информация о клиенте..."
          />

          <FieldErrors
            errors={state.errors?.notes}
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
            : "Создать клиента"}
        </button>
      </div>
    </form>
  );
}

type FieldProps = {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  defaultValue?: string;
  errors?: string[];
};

function Field({
  label,
  name,
  type = "text",
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
        type={type}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue ?? ""}
        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none transition focus:border-slate-500"
      />

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