"use client";

import Link from "next/link";
import {
  useActionState,
} from "react";

import {
  updateCompany,
} from "../../actions";
import type {
  UpdateCompanyState,
} from "@/lib/validation/company";

type CompanyData = {
  id: string;

  name: string;

  legalName:
    | string
    | null;

  taxId:
    | string
    | null;

  phone:
    | string
    | null;

  email:
    | string
    | null;

  website:
    | string
    | null;

  industry:
    | string
    | null;

  address:
    | string
    | null;

  status: string;

  ownerMemberId:
    | string
    | null;

  notes:
    | string
    | null;
};

type MemberOption = {
  id: string;

  displayName:
    | string
    | null;

  email:
    | string
    | null;

  status: string;
};

export function EditCompanyForm({
  company,
  members,
}: {
  company: CompanyData;
  members:
    MemberOption[];
}) {
  const initialState:
    UpdateCompanyState = {
      values: {
        name:
          company.name,

        legalName:
          company.legalName ??
          "",

        taxId:
          company.taxId ?? "",

        phone:
          company.phone ?? "",

        email:
          company.email ?? "",

        website:
          company.website ??
          "",

        industry:
          company.industry ??
          "",

        address:
          company.address ??
          "",

        status:
          company.status,

        ownerMemberId:
          company.ownerMemberId ??
          "",

        notes:
          company.notes ?? "",
      },
    };

  const updateAction =
    updateCompany.bind(
      null,
      company.id,
    );

  const [
    state,
    formAction,
    pending,
  ] = useActionState(
    updateAction,
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
            label="Название"
            name="name"
            required
            defaultValue={
              state.values?.name
            }
            errors={
              state.errors?.name
            }
          />

          <Field
            label="Юридическое название"
            name="legalName"
            defaultValue={
              state.values
                ?.legalName
            }
            errors={
              state.errors
                ?.legalName
            }
          />

          <Field
            label="БИН / налоговый ID"
            name="taxId"
            defaultValue={
              state.values?.taxId
            }
            errors={
              state.errors?.taxId
            }
          />

          <Field
            label="Отрасль"
            name="industry"
            defaultValue={
              state.values
                ?.industry
            }
            errors={
              state.errors
                ?.industry
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
                state.values
                  ?.status ??
                "active"
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-slate-500"
            >
              <option value="active">
                Активная
              </option>

              <option value="prospect">
                Потенциальная
              </option>

              <option value="inactive">
                Неактивная
              </option>
            </select>

            <FieldErrors
              errors={
                state.errors
                  ?.status
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
                ""
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-slate-500"
            >
              <option value="">
                Не назначен
              </option>

              {members.map(
                (member) => (
                  <option
                    key={
                      member.id
                    }
                    value={
                      member.id
                    }
                  >
                    {member.displayName ||
                      member.email ||
                      "Сотрудник"}
                    {member.status !==
                    "active"
                      ? " (неактивен)"
                      : ""}
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
            defaultValue={
              state.values?.email
            }
            errors={
              state.errors?.email
            }
          />

          <Field
            label="Веб-сайт"
            name="website"
            defaultValue={
              state.values
                ?.website
            }
            errors={
              state.errors
                ?.website
            }
          />
        </div>

        <div className="mt-6">
          <label
            htmlFor="address"
            className="mb-2 block text-sm font-medium"
          >
            Адрес
          </label>

          <textarea
            id="address"
            name="address"
            rows={3}
            defaultValue={
              state.values
                ?.address ?? ""
            }
            className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2.5 outline-none transition focus:border-slate-500"
          />

          <FieldErrors
            errors={
              state.errors
                ?.address
            }
          />
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">
          Заметки
        </h2>

        <textarea
          id="notes"
          name="notes"
          rows={6}
          defaultValue={
            state.values?.notes ??
            ""
          }
          className="mt-6 w-full resize-y rounded-lg border border-slate-300 px-3 py-2.5 outline-none transition focus:border-slate-500"
        />

        <FieldErrors
          errors={
            state.errors?.notes
          }
        />
      </section>

      <div className="flex justify-end gap-3">
        <Link
          href={`/crm/companies/${company.id}`}
          className="rounded-lg border border-slate-300 bg-white px-6 py-3 text-sm font-medium transition hover:bg-slate-50"
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
            : "Сохранить"}
        </button>
      </div>
    </form>
  );
}

type FieldProps = {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  errors?: string[];
};

function Field({
  label,
  name,
  type = "text",
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
        defaultValue={
          defaultValue ?? ""
        }
        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none transition focus:border-slate-500"
      />

      <FieldErrors
        errors={errors}
      />
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
      {errors.map(
        (error) => (
          <p
            key={error}
            className="text-sm text-red-600"
          >
            {error}
          </p>
        ),
      )}
    </div>
  );
}