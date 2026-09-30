import { requireVerifiedSession } from "@/lib/auth/verified-session";
import { listAccessibleOrganizations } from "@/modules/access/organization-selection";
import { LogoutButton } from "@/app/crm/logout-button";
import { selectOrganization } from "./actions";
import Link from "next/link";

export default async function OrganizationsPage({ searchParams }: {
  searchParams: Promise<{ reason?: string; joined?: string }>;
}) {
  const session = await requireVerifiedSession();
  const organizations = await listAccessibleOrganizations(session.user.id);
  const query = await searchParams;
  return <main className="min-h-screen bg-slate-100 px-4 py-12 text-slate-950">
    <section className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Выберите организацию</h1>
        <LogoutButton />
      </div>
      <p className="mt-2 text-sm text-slate-500">{session.user.email}</p>
      {query.reason === "context-changed" && <p role="alert" className="mt-5 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
        Организация изменилась после открытия формы. Изменения не сохранены. Выберите организацию и откройте запись заново.
      </p>}
      {query.reason === "unavailable" && <p role="alert" className="mt-5 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
        Выбранная организация недоступна. Выберите одну из доступных ниже.
      </p>}
      {query.joined === "1" && <p className="mt-5 text-sm text-emerald-700">Приглашение принято. Выберите организацию для работы.</p>}
      {organizations.length === 0 ? <p className="mt-6 text-slate-600">
        У вас пока нет доступа к активным организациям. Создайте свою или попросите администратора прислать приглашение на ваш email.
      </p> : <div className="mt-6 space-y-3">
        {organizations.map((organization) => <form key={organization.id} action={selectOrganization}>
          <input type="hidden" name="organizationId" value={organization.id} />
          <button type="submit" className="w-full rounded-xl border border-slate-200 px-5 py-4 text-left font-medium hover:bg-slate-50">
            {organization.name}
          </button>
        </form>)}
      </div>}
      <Link href="/organizations/new" className="mt-6 inline-block rounded-lg bg-slate-900 px-5 py-3 text-sm font-medium text-white">Создать организацию</Link>
    </section>
  </main>;
}
