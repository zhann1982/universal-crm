"use client";

import { useOrganizationId } from "@/modules/access/organization-context";


import { useToastTransition } from "@/modules/notifications/use-toast-transition";

import { restoreClient } from "../actions";

export function RestoreClientButton({
  clientId,
}: {
  clientId: string;
}) {
  const organizationScope = useOrganizationId();
  const [pending, startTransition] =
    useToastTransition();

  function handleRestore() {
    const confirmed =
      window.confirm(
        "Восстановить клиента из архива?",
      );

    if (!confirmed) {
      return;
    }

    startTransition(async () => {
      await restoreClient(organizationScope, clientId);
    });
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={handleRestore}
      className="rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending
        ? "Восстановление..."
        : "Восстановить"}
    </button>
  );
}