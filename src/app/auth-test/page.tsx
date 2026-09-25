import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/auth";

import { LogoutButton } from "./logout-button";

export default async function AuthTestPage() {
  const session =
    await auth.api.getSession({
      headers: await headers(),
    });

  if (!session) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-slate-100 p-8">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="text-sm font-medium text-emerald-600">
            Better Auth работает
          </div>

          <h1 className="mt-2 text-3xl font-bold">
            Активная сессия
          </h1>

          <p className="mt-2 text-slate-500">
            Эти данные получены на
            сервере из Better Auth.
          </p>

          <dl className="mt-8 space-y-5">
            <InfoItem
              label="User ID"
              value={session.user.id}
            />

            <InfoItem
              label="Имя"
              value={session.user.name}
            />

            <InfoItem
              label="Email"
              value={session.user.email}
            />

            <InfoItem
              label="Session ID"
              value={session.session.id}
            />
          </dl>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/crm"
              className="rounded-lg bg-slate-950 px-5 py-3 text-sm font-medium text-white"
            >
              Открыть CRM
            </Link>

            <LogoutButton />
          </div>
        </div>
      </div>
    </main>
  );
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </dt>

      <dd className="mt-1 break-all text-sm text-slate-900">
        {value}
      </dd>
    </div>
  );
}