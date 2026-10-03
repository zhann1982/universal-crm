"use client";

import Link, { useLinkStatus } from "next/link";
import { createPortal } from "react-dom";
import type { ComponentProps } from "react";

// Keep Next.js navigation/prefetch behavior and expose its real pending state.
export default function AppLink({ children, ...props }: ComponentProps<typeof Link>) {
  return <Link {...props}>{children}<NavigationProgress /></Link>;
}

function NavigationProgress() {
  const { pending } = useLinkStatus();
  if (!pending || typeof document === "undefined") return null;
  // A portal keeps the bar outside cards with overflow/filter styles.
  return createPortal(<span className="crm-navigation-progress" role="status" aria-label="Загрузка страницы">
    <span className="sr-only">Загрузка страницы…</span>
  </span>, document.body);
}
