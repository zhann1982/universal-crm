"use client";

import {
  useTransition,
} from "react";

import {
  archiveCompany,
} from "../actions";

export function ArchiveCompanyButton({
  companyId,
}: {
  companyId: string;
}) {
  const [
    pending,
    startTransition,
  ] = useTransition();

  function handleArchive() {
    const confirmed =
      window.confirm(
        "Переместить компанию в архив?",
      );

    if (!confirmed) {
      return;
    }

    startTransition(() => {
      void archiveCompany(
        companyId,
      );
    });
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={handleArchive}
      className="rounded-lg border border-red-200 bg-white px-5 py-2.5 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-50"
    >
      {pending
        ? "Архивирование..."
        : "В архив"}
    </button>
  );
}