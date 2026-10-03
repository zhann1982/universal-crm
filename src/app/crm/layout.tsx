import { OrganizationProvider } from "@/modules/access/organization-context";
import Link from "next/link";

import { getCurrentAccessContext } from "@/lib/auth/permissions";

import { LogoutButton } from "./logout-button";
import "./crm-theme.css";

export default async function CrmLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const {
    organization,
    member,
    user,
    permissions,
  } =
    await getCurrentAccessContext();

  return (
    <OrganizationProvider key={organization.id} organizationId={organization.id}>
    <div className="crm-shell min-h-screen bg-slate-100 text-slate-950">
      <div className="flex min-h-screen">
        <aside className="w-64 shrink-0 border-r border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-6 py-5">
            <div className="text-xl font-bold">
              <span className="crm-brand">Universal <strong>CRM</strong></span>
            </div>

            <div className="mt-1 text-xs text-slate-500">
              {organization.name}
            </div>
          </div>

          <Link href="/organizations" className="mx-4 mt-3 block rounded-lg border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50">
            Сменить организацию
          </Link>
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

            {permissions.has(
              "companies.read",
            ) && (
              <NavigationLink
                href="/crm/companies"
                label="Компании"
              />
            )}

            {permissions.has(
              "deals.read",
            ) ? (
              <NavigationLink
                href="/crm/deals"
                label="Сделки"
              />
            ) : (
              <DisabledNavigation
                label="Сделки"
              />
            )}

            {permissions.has(
              "tasks.read",
            ) ? (
              <NavigationLink
                href="/crm/tasks"
                label="Задачи"
              />
            ) : (
              <DisabledNavigation
                label="Задачи"
              />
            )}

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
    </OrganizationProvider>
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
      <NavigationIcon label={label} />
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
      <NavigationIcon label={label} />
      {label}
    </div>
  );
}

function NavigationIcon({ label }: { label: string }) {
  const paths: Record<string, string> = {
    Dashboard: "M3 10 12 3l9 7M5 9v12h5v-7h4v7h5V9",
    Клиенты: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M17 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87",
    Компании: "M3 21h18M5 21V3h14v18M9 7h1m4 0h1M9 11h1m4 0h1M10 21v-6h4v6",
    Сделки: "M3 7h18v14H3zM8 7V3h8v4M3 12h18M10 12v3h4v-3",
    Задачи: "M9 5h12M9 12h12M9 19h12M2 5l2 2 3-4M2 12l2 2 3-4M2 19l2 2 3-4",
    Команда: "M4 21v-3a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v3M12 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
    Настройки: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2",
  };
  return (
    <svg className="crm-nav-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[label] || paths.Dashboard} />
    </svg>
  );
}
