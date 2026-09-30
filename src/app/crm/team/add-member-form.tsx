"use client";

import { OrganizationForm } from "@/modules/access/organization-context";


import {
  useActionState,
} from "react";

import {
  inviteMember,
  type InviteMemberState,
} from "./actions";

type RoleOption = {
  id: string;
  name: string;
  description: string | null;
};

const initialState:
  InviteMemberState = {
    status: "idle",
  };

export function AddMemberForm({
  roles,
}: {
  roles: RoleOption[];
}) {
  const [
    state,
    formAction,
    pending,
  ] = useActionState(
    inviteMember,
    initialState,
  );

  return (
    <section className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold">
        Пригласить сотрудника
      </h2>

      <p className="mt-1 text-sm text-slate-500">
        Пользователь может быть ещё
        не зарегистрирован. Доступ к
        CRM появится только после
        принятия приглашения.
      </p>

      {state.status ===
        "created" && (
        <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <div className="font-medium">
            Приглашение создано для{" "}
            {state.email}.
          </div>

          <p className="mt-2">
            Пока отправка email ещё
            не подключена, скопируйте
            этот токен. Он показывается
            здесь только после создания
            приглашения.
          </p>

          <div className="mt-3 break-all rounded-lg border border-emerald-200 bg-white px-3 py-2 font-mono text-xs">
            {state.token}
          </div>

          <div className="mt-3 text-xs text-emerald-700">
            Действует до:{" "}
            {new Date(
              state.expiresAt,
            ).toLocaleString(
              "ru-RU",
            )}
          </div>
        </div>
      )}

      {state.status ===
        "error" && (
        <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.message}
        </div>
      )}

      <OrganizationForm
        action={formAction}
        className="mt-5 grid gap-4 md:grid-cols-[1fr_220px_auto]"
      >
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="user@example.com"
          className="rounded-lg border border-slate-300 px-4 py-2.5 outline-none focus:border-slate-500"
        />

        <select
          name="roleId"
          required
          defaultValue=""
          className="rounded-lg border border-slate-300 bg-white px-4 py-2.5"
        >
          <option
            value=""
            disabled
          >
            Выберите роль
          </option>

          {roles.map(
            (role) => (
              <option
                key={role.id}
                value={role.id}
              >
                {role.name}
              </option>
            ),
          )}
        </select>

        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending
            ? "Создаём..."
            : "Создать приглашение"}
        </button>
      </OrganizationForm>
    </section>
  );
}