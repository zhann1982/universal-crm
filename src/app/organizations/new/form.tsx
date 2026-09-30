"use client";

import { useActionState, useState } from "react";
import { submitOrganization } from "./actions";

export function CreateOrganizationForm({ requestId }: { requestId: string }) {
  const [state, action, pending] = useActionState(submitOrganization, { error: null });
  const [name, setName] = useState("");
  return <form action={action} className="mt-6 space-y-5">
    <input type="hidden" name="requestId" value={requestId} />
    <div>
      <label htmlFor="organization-name" className="block text-sm font-medium">Название организации</label>
      <input id="organization-name" name="name" required maxLength={160} autoComplete="organization"
        value={name} onChange={(event) => setName(event.target.value)}
        placeholder="Например, Альфа" className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2" />
    </div>
    {state.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}
    <button disabled={pending} type="submit" className="rounded-lg bg-slate-900 px-5 py-3 font-medium text-white disabled:opacity-50">
      {pending ? "Создаём организацию…" : "Создать организацию"}
    </button>
  </form>;
}
