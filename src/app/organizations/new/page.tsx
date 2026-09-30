import { randomUUID } from "node:crypto";
import Link from "next/link";
import { requireVerifiedSession } from "@/lib/auth/verified-session";
import { CreateOrganizationForm } from "./form";

export default async function NewOrganizationPage() {
  await requireVerifiedSession();
  return <main className="min-h-screen bg-slate-100 px-4 py-12 text-slate-950">
    <section className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <Link href="/organizations" className="text-sm text-slate-600 hover:underline">← К выбору организации</Link>
      <h1 className="mt-5 text-2xl font-bold">Новая организация</h1>
      <p className="mt-3 text-sm text-slate-600">Вы станете владельцем организации. Мы подготовим роли и воронку продаж, чтобы можно было сразу начать работу. Коллег можно добавить через приглашения.</p>
      <CreateOrganizationForm requestId={randomUUID()} />
    </section>
  </main>;
}
