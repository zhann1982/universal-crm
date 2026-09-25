"use client";

import { useTransition } from "react";

import { restoreClient } from "../actions";

export function RestoreClientButton({
  clientId,
}: {
  clientId: string;
}) {
  const [pending, startTransition] =
    useTransition();

  function handleRestore() {
    const confirmed =
      window.confirm(
        "Восстановить клиента из архива?",
      );

    if (!confirmed) {
      return;
    }

    startTransition(() => {
      void restoreClient(clientId);
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