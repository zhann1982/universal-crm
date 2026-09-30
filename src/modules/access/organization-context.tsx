"use client";

import { createContext, useContext, type ComponentProps, type ReactNode } from "react";

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
  return <form {...props}>
    {typeof props.action === "function" && <input type="hidden" name="_organizationId" value={organizationId} />}
    {children}
  </form>;
}
