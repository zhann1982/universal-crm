"use client";

import {
  useState,
} from "react";

type ScheduleErrors = {
  dueAt?: string[];
  reminderAt?: string[];
  recurrenceFrequency?: string[];
  recurrenceInterval?: string[];
  recurrenceEndAt?: string[];
};

export function TaskScheduleFields({
  dueAt = "",
  reminderAt = "",
  recurrenceFrequency = "none",
  recurrenceInterval = "1",
  recurrenceEndAt = "",
  errors,
}: {
  dueAt?: string;
  reminderAt?: string;
  recurrenceFrequency?: string;
  recurrenceInterval?: string;
  recurrenceEndAt?: string;
  errors?: ScheduleErrors;
}) {
  const [dueAtIso, setDueAtIso] =
    useState(dueAt);

  const [reminderAtIso, setReminderAtIso] =
    useState(reminderAt);

  const [recurrenceEndAtIso, setRecurrenceEndAtIso] =
    useState(recurrenceEndAt);

  const [frequency, setFrequency] =
    useState(
      recurrenceFrequency,
    );

  const recurrenceEnabled =
    frequency !== "none";

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold">
        Сроки и повтор
      </h2>

      <p className="mt-1 text-sm text-slate-500">
        Напоминание работает внутри CRM. Повторяющаяся задача создаёт следующую задачу после выполнения текущей.
      </p>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <DateTimeField
          id="dueAtLocal"
          label="Срок выполнения"
          initialIso={dueAtIso}
          onIsoChange={setDueAtIso}
          errors={errors?.dueAt}
        />

        <DateTimeField
          id="reminderAtLocal"
          label="Напомнить"
          initialIso={reminderAtIso}
          onIsoChange={setReminderAtIso}
          errors={errors?.reminderAt}
        />

        <div>
          <label
            htmlFor="recurrenceFrequency"
            className="mb-2 block text-sm font-medium"
          >
            Повтор
          </label>

          <select
            id="recurrenceFrequency"
            name="recurrenceFrequency"
            value={frequency}
            onChange={(event) => {
              const next =
                event.target.value;

              setFrequency(next);

              if (next === "none") {
                setRecurrenceEndAtIso("");
              }
            }}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-slate-500"
          >
            <option value="none">
              Не повторять
            </option>
            <option value="daily">
              Каждый N день
            </option>
            <option value="weekly">
              Каждую N неделю
            </option>
            <option value="monthly">
              Каждый N месяц
            </option>
            <option value="yearly">
              Каждый N год
            </option>
          </select>

          <FieldErrors
            errors={
              errors?.recurrenceFrequency
            }
          />
        </div>

        <div>
          <label
            htmlFor="recurrenceInterval"
            className="mb-2 block text-sm font-medium"
          >
            Интервал повторения
          </label>

          <input
            id="recurrenceInterval"
            name="recurrenceInterval"
            type="number"
            min={1}
            max={365}
            defaultValue={
              recurrenceInterval || "1"
            }
            disabled={
              !recurrenceEnabled
            }
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none transition focus:border-slate-500 disabled:bg-slate-100 disabled:text-slate-400"
          />

          {!recurrenceEnabled && (
            <input
              type="hidden"
              name="recurrenceInterval"
              value="1"
            />
          )}

          <FieldErrors
            errors={
              errors?.recurrenceInterval
            }
          />
        </div>

        <div className="md:col-span-2">
          <label
            htmlFor="recurrenceEndAtLocal"
            className="mb-2 block text-sm font-medium"
          >
            Повторять до
          </label>

          <input
                id="recurrenceEndAtLocal"
            type="datetime-local"
            value={
              isoToLocalInput(
                recurrenceEndAtIso,
              )
            }
            disabled={
              !recurrenceEnabled
            }
            onChange={(event) => {
              const value =
                event.target.value;

              setRecurrenceEndAtIso(
                value
                  ? new Date(
                      value,
                    ).toISOString()
                  : "",
              );
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none transition focus:border-slate-500 disabled:bg-slate-100 disabled:text-slate-400"
          />

          <input
            type="hidden"
            name="recurrenceEndAt"
            value={
              recurrenceEnabled
                ? recurrenceEndAtIso
                : ""
            }
          />

          <FieldErrors
            errors={
              errors?.recurrenceEndAt
            }
          />
        </div>
      </div>

      <input
        type="hidden"
        name="dueAt"
        value={dueAtIso}
      />

      <input
        type="hidden"
        name="reminderAt"
        value={reminderAtIso}
      />
    </section>
  );
}

function DateTimeField({
  id,
  label,
  initialIso,
  onIsoChange,
  errors,
}: {
  id: string;
  label: string;
  initialIso: string;
  onIsoChange: (
    value: string,
  ) => void;
  errors?: string[];
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 block text-sm font-medium"
      >
        {label}
      </label>

      <input
        id={id}
        type="datetime-local"
        defaultValue={
          isoToLocalInput(
            initialIso,
          )
        }
        onChange={(event) => {
          const value =
            event.target.value;

          onIsoChange(
            value
              ? new Date(
                  value,
                ).toISOString()
              : "",
          );
        }}
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
