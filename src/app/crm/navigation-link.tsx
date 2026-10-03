"use client";

import Link from "@/components/app-link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function NavigationLink({ href, label, children }: { href: string; label: string; children: ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/crm" && pathname.startsWith(`${href}/`));
  return <Link href={href} aria-current={active ? "page" : undefined}
    className="block rounded-lg px-4 py-3 text-sm font-medium transition hover:bg-slate-100">
    {children}{label}
  </Link>;
}
