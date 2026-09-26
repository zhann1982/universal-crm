"use client";

import Link from "next/link";
import {
  useActionState,
  useState,
} from "react";

import {
  updateDeal,
} from "../../actions";
import type {
  UpdateDealState,
} from "@/lib/validation/deal";

type PipelineOption = {
  id: string;
  name: string;
  isDefault: boolean;
};

type StageOption = {
  id: string;
  pipelineId: string;
  name: string;
  type: string;
  position: number;
};

type CompanyOption = {
  id: string;
  name: string;

  taxId:
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
};

type InitialValues = {
  title: string;

  pipelineId: string;

  stageId: string;

  amount: string;

  currency: string;

  companyId: string;

  ownerMemberId: string;

  expectedCloseAt: string;

  notes: string;
};

export function EditDealForm({
  dealId,
  initialVersion,
  pipelines,
  stages,
  companies,
  members,
  initialValues,
}: {
  dealId: string;

  initialVersion: number;

  pipelines:
    PipelineOption[];

  stages:
    StageOption[];

  companies:
    CompanyOption[];

  members:
    MemberOption[];

  initialValues:
    InitialValues;
}) {
  const initialState:
    UpdateDealState = {
      values:
        initialValues,
    };

  const updateAction =
    updateDeal.bind(
      null,
      dealId,
    );

  const [
    state,
    formAction,
    pending,
  ] = useActionState(
    updateAction,
    initialState,
  );

  const [
    selectedPipelineId,
    setSelectedPipelineId,
  ] = useState(
    state.values
      ?.pipelineId ??
      initialValues.pipelineId,
  );

  const currentStages =
    stages.filter(
      (stage) =>
        stage.pipelineId ===
        selectedPipelineId,
    );

  const savedStageId =
    state.values?.stageId ??
    initialValues.stageId;

  const stageExists =
    currentStages.some(
      (stage) =>
        stage.id ===
        savedStageId,
    );

  const stageDefaultValue =
    stageExists
      ? savedStageId
      : currentStages[0]?.id ??
        "";

  return (
    <form
      action={formAction}
      className="space-y-8"
    >
      <input
        type="hidden"
        name="version"
        value={
          initialVersion
        }
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

        <div className="mt-6">
          <Field
            label="Название сделки"
            name="title"
            required
            defaultValue={
              state.values
                ?.title ??
              initialValues.title
            }
            errors={
              state.errors?.title
            }
          />
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div>
            <label
              htmlFor="pipelineId"
              className="mb-2 block text-sm font-medium"
            >
              Воронка
              <span className="ml-1 text-red-500">
                *
              </span>
            </label>

            <select
              id="pipelineId"
              name="pipelineId"
              value={
                selectedPipelineId
              }
              onChange={(
                event,
              ) => {
                setSelectedPipelineId(
                  event.target.value,
                );
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-slate-500"
            >
              {pipelines.map(
                (pipeline) => (
                  <option
                    key={
                      pipeline.id
                    }
                    value={
                      pipeline.id
                    }
                  >
                    {
                      pipeline.name
                    }

                    {pipeline.isDefault
                      ? " — основная"
                      : ""}
                  </option>
                ),
              )}
            </select>

            <FieldErrors
              errors={
                state.errors
                  ?.pipelineId
              }
            />
          </div>

          <div>
            <label
              htmlFor="stageId"
              className="mb-2 block text-sm font-medium"
            >
              Этап
              <span className="ml-1 text-red-500">
                *
              </span>
            </label>

            <select
              key={
                selectedPipelineId
              }
              id="stageId"
              name="stageId"
              required
              defaultValue={
                stageDefaultValue
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-slate-500"
            >
              {currentStages.map(
                (stage) => (
                  <option
                    key={
                      stage.id
                    }
                    value={
                      stage.id
                    }
                  >
                    {
                      stage.name
                    }
                  </option>
                ),
              )}
            </select>

            {currentStages.length ===
              0 && (
              <p className="mt-2 text-sm text-red-600">
                У этой воронки нет этапов.
              </p>
            )}

            <FieldErrors
              errors={
                state.errors
                  ?.stageId
              }
            />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">
          Стоимость
        </h2>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <Field
            label="Сумма"
            name="amount"
            inputMode="decimal"
            placeholder="1500000"
            defaultValue={
              state.values
                ?.amount ??
              initialValues.amount
            }
            errors={
              state.errors
                ?.amount
            }
          />

          <Field
            label="Валюта"
            name="currency"
            maxLength={3}
            placeholder="KZT"
            defaultValue={
              state.values
                ?.currency ??
              initialValues.currency
            }
            errors={
              state.errors
                ?.currency
            }
          />
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">
          Связи и ответственный
        </h2>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div>
            <label
              htmlFor="companyId"
              className="mb-2 block text-sm font-medium"
            >
              Компания
            </label>

            <select
              id="companyId"
              name="companyId"
              defaultValue={
                state.values
                  ?.companyId ??
                initialValues.companyId
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-slate-500"
            >
              <option value="">
                Не выбрана
              </option>

              {companies.map(
                (company) => (
                  <option
                    key={
                      company.id
                    }
                    value={
                      company.id
                    }
                  >
                    {
                      company.name
                    }

                    {company.taxId
                      ? ` — ${company.taxId}`
                      : ""}
                  </option>
                ),
              )}
            </select>

            <FieldErrors
              errors={
                state.errors
                  ?.companyId
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
                initialValues.ownerMemberId
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
          Планирование
        </h2>

        <div className="mt-6 max-w-md">
          <Field
            label="Ожидаемая дата закрытия"
            name="expectedCloseAt"
            type="date"
            defaultValue={
              state.values
                ?.expectedCloseAt ??
              initialValues.expectedCloseAt
            }
            errors={
              state.errors
                ?.expectedCloseAt
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
            state.values
              ?.notes ??
            initialValues.notes
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
          href={`/crm/deals/${dealId}`}
          className="rounded-lg border border-slate-300 bg-white px-6 py-3 text-sm font-medium transition hover:bg-slate-50"
        >
          Отмена
        </Link>

        <button
          type="submit"
          disabled={
            pending ||
            currentStages.length ===
              0
          }
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

  placeholder?: string;

  inputMode?:
    | "text"
    | "decimal"
    | "numeric";

  maxLength?: number;

  errors?: string[];
};

function Field({
  label,
  name,
  type = "text",
  required,
  defaultValue,
  placeholder,
  inputMode,
  maxLength,
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
        placeholder={
          placeholder
        }
        inputMode={
          inputMode
        }
        maxLength={
          maxLength
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