import Link from "next/link";

export default function NoAccessPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="text-5xl font-bold text-slate-200">
          403
        </div>

        <h1 className="mt-5 text-2xl font-bold">
          Нет доступа к CRM
        </h1>

        <p className="mt-3 text-sm leading-6 text-slate-500">
          Вы успешно вошли в систему,
          но ваш аккаунт не является
          активным сотрудником текущей
          организации.
        </p>

        <div className="mt-7 flex justify-center gap-3">
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