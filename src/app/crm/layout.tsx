import Link from "next/link";

export default function CrmLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="flex min-h-screen">
        <aside className="w-64 border-r border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-6 py-5">
            <div className="text-xl font-bold">Universal CRM</div>
            <div className="mt-1 text-xs text-slate-500">
              Development CRM
            </div>
          </div>

          <nav className="space-y-1 p-4">
            <Link
              href="/crm"
              className="block rounded-lg px-4 py-3 hover:bg-slate-100"
            >
              Dashboard
            </Link>

            <Link
              href="/crm/clients"
              className="block rounded-lg px-4 py-3 hover:bg-slate-100"
            >
              Клиенты
            </Link>

            <div className="px-4 py-3 text-slate-400">
              Сделки
            </div>

            <div className="px-4 py-3 text-slate-400">
              Задачи
            </div>

            <div className="px-4 py-3 text-slate-400">
              Команда
            </div>

            <div className="px-4 py-3 text-slate-400">
              Настройки
            </div>
          </nav>
        </aside>

        <main className="flex-1">
          <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-8">
            <span className="font-medium">Universal CRM</span>

            <div className="text-sm text-slate-500">
              Development Owner
            </div>
          </header>

          <div className="p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}