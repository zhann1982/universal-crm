"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { authClient } from "@/lib/auth/auth-client";

export function LogoutButton() {
  const router = useRouter();

  const [
    isPending,
    setIsPending,
  ] = useState(false);

  async function handleLogout() {
    setIsPending(true);

    try {
      await authClient.signOut();

      router.replace("/login");
      router.refresh();
    } finally {
      setIsPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isPending}
      className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-medium transition hover:bg-slate-50 disabled:opacity-60"
    >
      {isPending
        ? "Выход..."
        : "Выйти"}
    </button>
  );
}