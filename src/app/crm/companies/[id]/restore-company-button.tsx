"use client";

import {
  useTransition,
} from "react";

import {
  restoreCompany,
} from "../actions";

export function RestoreCompanyButton({
  companyId,
  returnTo = "detail",
}: {
  companyId: string;

  returnTo?:
    | "detail"
    | "list";
}) {
  const [
    pending,
    startTransition,
  ] = useTransition();

  function handleRestore() {
    const confirmed =
      window.confirm(
        "Восстановить компанию из архива?",
      );

    if (!confirmed) {
      return;
    }

    startTransition(() => {
      void restoreCompany(
        companyId,
        returnTo,
      );
    });
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={
        handleRestore
      }
      className="rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending
        ? "Восстановление..."
        : "Восстановить"}
    </button>
  );
}