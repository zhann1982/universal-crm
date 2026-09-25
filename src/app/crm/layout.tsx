import Link from "next/link";

const navigation = [
  {
    href: "/crm",
    label: "Dashboard",
    enabled: true,
  },
  {
    href: "/crm/clients",
    label: "Клиенты",
    enabled: true,
  },
  {
    href: "/crm/deals",
    label: "Сделки",
    enabled: false,
  },
  {
    href: "/crm/tasks",
    label: "Задачи",
    enabled: false,
  },
  {
    href: "/crm/team",
    label: "Команда",
    enabled: false,
  },
  {
    href: "/crm/settings",
    label: "Настройки",
    enabled: false,
  },
];

export default function CrmLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <div className="flex min-h-screen">
        <aside className="w-64 shrink-0 border-r border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-6 py-5">
            <div className="text-xl font-bold">
              Universal CRM
            </div>

            <div className="mt-1 text-xs text-slate-500">
              Development CRM
            </div>
          </div>

          <nav className="space-y-1 p-4">
            {navigation.map((item) =>
              item.enabled ? (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block rounded-lg px-4 py-3 text-sm font-medium transition hover:bg-slate-100"
                >
                  {item.label}
                </Link>
              ) : (
                <div
                  key={item.href}
                  className="cursor-not-allowed rounded-lg px-4 py-3 text-sm text-slate-400"
                >
                  {item.label}
                </div>
              ),
            )}
          </nav>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-8">
            <div className="font-medium">
              Universal CRM
            </div>

            <div className="text-sm text-slate-500">
              Development Owner
            </div>
          </header>

          <main className="p-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}