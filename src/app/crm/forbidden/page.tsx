import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <div className="mx-auto max-w-xl py-20 text-center">
      <div className="text-6xl font-bold text-slate-200">
        403
      </div>

      <h1 className="mt-6 text-2xl font-bold">
        Доступ запрещён
      </h1>

      <p className="mt-3 text-slate-500">
        У вашей роли нет разрешения
        для выполнения этого действия.
      </p>

      <Link
        href="/crm"
        className="mt-8 inline-block rounded-lg bg-slate-950 px-5 py-3 text-sm font-medium text-white"
      >
        Вернуться в CRM
      </Link>
    </div>
  );
}