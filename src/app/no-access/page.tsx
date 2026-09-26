import Link from "next/link";

type SearchParams = {
  reason?:
    | string
    | string[]
    | undefined;
};

export default async function NoAccessPage({
  searchParams,
}: {
  searchParams:
    Promise<SearchParams>;
}) {
  const query =
    await searchParams;

  const reason =
    Array.isArray(
      query.reason,
    )
      ? query.reason[0]
      : query.reason;

  const organizationInactive =
    reason ===
    "organization-inactive";

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="text-5xl font-bold text-slate-200">
          403
        </div>

        <h1 className="mt-5 text-2xl font-bold">
          {organizationInactive
            ? "Организация отключена"
            : "Нет доступа к CRM"}
        </h1>

        <p className="mt-3 text-sm leading-6 text-slate-500">
          {organizationInactive
            ? "Текущая организация деактивирована. Доступ к данным CRM временно заблокирован."
            : "Вы успешно вошли в систему, но ваш аккаунт не является активным сотрудником текущей организации."}
        </p>

        {organizationInactive && (
          <p className="mt-3 text-sm leading-6 text-slate-500">
            После повторной активации
            организации доступ будет
            восстановлен без удаления
            её данных.
          </p>
        )}

        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link
            href="/auth-test"
            className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-medium transition hover:bg-slate-50"
          >
            Мой аккаунт
          </Link>

          <Link
            href="/login"
            className="rounded-lg bg-slate-950 px-5 py-3 text-sm font-medium text-white"
          >
            Войти другим аккаунтом
          </Link>
        </div>
      </div>
    </main>
  );
}