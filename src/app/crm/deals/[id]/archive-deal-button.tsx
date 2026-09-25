"use client";

import {
  useTransition,
} from "react";

import {
  archiveDeal,
} from "../actions";

export function ArchiveDealButton({
  dealId,
}: {
  dealId: string;
}) {
  const [
    pending,
    startTransition,
  ] = useTransition();

  function handleArchive() {
    const confirmed =
      window.confirm(
        "Переместить сделку в архив?",
      );

    if (!confirmed) {
      return;
    }

    startTransition(() => {
      void archiveDeal(
        dealId,
      );
    });
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={
        handleArchive
      }
      className="rounded-lg border border-red-200 bg-white px-5 py-2.5 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending
        ? "Архивирование..."
        : "В архив"}
    </button>
  );
}