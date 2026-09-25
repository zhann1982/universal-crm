import { addMember } from "./actions";

type RoleOption = {
  id: string;
  name: string;
  description: string | null;
};

export function AddMemberForm({
  roles,
}: {
  roles: RoleOption[];
}) {
  return (
    <section className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold">
        Добавить сотрудника
      </h2>

      <p className="mt-1 text-sm text-slate-500">
        Пользователь должен сначала
        зарегистрировать аккаунт.
      </p>

      <form
        action={addMember}
        className="mt-5 grid gap-4 md:grid-cols-[1fr_220px_auto]"
      >
        <input
          type="email"
          name="email"
          required
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
          className="rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          Добавить
        </button>
      </form>
    </section>
  );
}