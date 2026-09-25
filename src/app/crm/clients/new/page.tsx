import Link from "next/link";

import { ClientForm } from "./client-form";

export default function NewClientPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8">
        <Link
          href="/crm/clients"
          className="text-sm text-slate-500 transition hover:text-slate-900"
        >
          ← Назад к клиентам
        </Link>

        <h1 className="mt-4 text-3xl font-bold">
          Новый клиент
        </h1>

        <p className="mt-2 text-slate-500">
          Добавьте клиента в CRM.
        </p>
      </div>

      <ClientForm />
    </div>
  );
}