"use client";

import { useOrganizationId } from "@/modules/access/organization-context";

import { useToastTransition } from "@/modules/notifications/use-toast-transition";

import { restoreDeal } from "../actions";

export function RestoreDealButton({
  dealId,
  version,
}: {
  dealId: string;
  version: number;
}) {
  const organizationScope = useOrganizationId();
  const [pending, startTransition] = useToastTransition();

  function handleRestore() {
    const confirmed = window.confirm("Восстановить сделку из архива?");

    if (!confirmed) {
      return;
    }

    startTransition(async () => {
      await restoreDeal(organizationScope, dealId, version);
    });
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={handleRestore}
      className="rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Восстановление..." : "Восстановить"}
    </button>
  );
}
