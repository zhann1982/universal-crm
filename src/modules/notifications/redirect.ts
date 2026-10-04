import { redirect } from "next/navigation";
import type { Notice } from "./feedback";

export function redirectWithNotice(destination: string, notice: Notice): never {
  const url = new URL(destination, "https://crm.invalid");
  if (url.origin !== "https://crm.invalid" || !url.pathname.startsWith("/crm")) throw new Error("Invalid feedback destination");
  url.searchParams.delete("error");
  url.searchParams.set("_notice", notice);
  url.searchParams.set("_noticeId", crypto.randomUUID());
  redirect(`${url.pathname}${url.search}${url.hash}`);
}
