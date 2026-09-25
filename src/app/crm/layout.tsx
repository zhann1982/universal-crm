import Link from "next/link";

import { getCurrentAccessContext } from "@/lib/auth/permissions";

import { LogoutButton } from "./logout-button";

export default async function CrmLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const {
    member,
    user,
    permissions,
  } =
    await getCurrentAccessContext();

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
            <NavigationLink
              href="/crm"
              label="Dashboard"
            />

            {permissions.has(
              "clients.read",
            ) && (
              <NavigationLink
                href="/crm/clients"
                label="Клиенты"
              />
            )}

            <DisabledNavigation
              label="Сделки"
            />

            <DisabledNavigation
              label="Задачи"
            />

            {permissions.has(
              "members.read",
            ) ? (
              <NavigationLink
                href="/crm/team"
                label="Команда"
              />
            ) : (
              <DisabledNavigation
                label="Команда"
              />
            )}

            <DisabledNavigation
              label="Настройки"
            />
          </nav>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="flex min-h-16 items-center justify-between gap-6 border-b border-slate-200 bg-white px-8 py-3">
            <div className="font-medium">
              Universal CRM
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-sm font-medium">
                  {member.displayName ||
                    user.name ||
                    member.userId}
                </div>

                <div className="text-xs text-slate-500">
                  {user.email}
                </div>
              </div>

              <LogoutButton />
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

function NavigationLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-lg px-4 py-3 text-sm font-medium transition hover:bg-slate-100"
    >
      {label}
    </Link>
  );
}

function DisabledNavigation({
  label,
}: {
  label: string;
}) {
  return (
    <div className="cursor-not-allowed rounded-lg px-4 py-3 text-sm text-slate-400">
      {label}
    </div>
  );
}