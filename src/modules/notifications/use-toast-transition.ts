"use client";

import { useTransition } from "react";
import { useToast, runWithToast, isNavigationError } from "./toast-provider";

export function useToastTransition() {
  const [pending, startTransition] = useTransition();
  const notify = useToast();
  const start = (action: () => Promise<void>) => startTransition(async () => {
    try { await runWithToast(notify, action); }
    catch (error) { if (isNavigationError(error)) throw error; }
  });
  return [pending, start] as const;
}
