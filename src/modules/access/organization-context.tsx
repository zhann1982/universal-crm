"use client";

import { createContext, useContext, type ComponentProps, type ReactNode } from "react";
import { useToast, runWithToast, notifyActionResult, isNavigationError } from "@/modules/notifications/toast-provider";

const OrganizationContext = createContext<string | null>(null);

export function OrganizationProvider({ organizationId, children }: { organizationId: string; children: ReactNode }) {
  return <OrganizationContext.Provider value={organizationId}>{children}</OrganizationContext.Provider>;
}

export function useOrganizationId() {
  const id = useContext(OrganizationContext);
  if (!id) throw new Error("CRM mutation must have an OrganizationProvider");
  return id;
}

// Captures the organization rendered in this tab. The server compares it with
// its freshly authorized selection; the hidden field never grants access.
export function OrganizationForm({ children, ...props }: ComponentProps<"form">) {
  const organizationId = useOrganizationId();
  const notify = useToast();
  const action = props.action;
  return <form {...props} action={typeof action === "function" ? async form => {
    try {
      const result = await runWithToast(notify, async () => action(form));
      notifyActionResult(notify, result);
    } catch (error) {
      if (isNavigationError(error)) throw error;
    }
  } : action}>
    {typeof props.action === "function" && <input type="hidden" name="_organizationId" value={organizationId} />}
    {children}
  </form>;
}
