import { createHash } from "node:crypto";
import { z } from "zod";

export type EmailDelivery = "accepted" | "not-configured" | "failed";
// Provider acceptance is not proof that the recipient received the message.
export async function sendEmail(input: {
  to: string;
  subject: string;
  text: string;
  key: string;
}): Promise<EmailDelivery> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) return "not-configured";
  if (!z.email().safeParse(input.to).success || /[\r\n]/.test(from))
    return "failed";
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": createHash("sha256").update(input.key).digest("hex"),
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        text: input.text,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return "failed";
    const data: unknown = await response.json();
    return z.object({ id: z.string().min(1) }).safeParse(data).success
      ? "accepted"
      : "failed";
  } catch {
    return "failed";
  }
}

export function invitationLink(token: string) {
  const base = process.env.BETTER_AUTH_URL;
  if (!base) return null;
  try {
    const origin = new URL(base);
    if (
      !["http:", "https:"].includes(origin.protocol) ||
      origin.username ||
      origin.password
    )
      return null;
    if (process.env.NODE_ENV === "production" && origin.protocol !== "https:")
      return null;
    const link = new URL("/invite", origin.origin);
    link.searchParams.set("token", token);
    return link.toString();
  } catch {
    return null;
  }
}

export async function deliverInvitation(input: {
  invitationId: string;
  email: string;
  token: string;
  organizationName: string;
}) {
  const link = invitationLink(input.token);
  const delivery = link
    ? await sendEmail({
        to: input.email,
        subject: "Приглашение в Universal CRM",
        text: `Вас пригласили в организацию «${input.organizationName}».\n\nПримите приглашение: ${link}\n\nВойдите с этим адресом email и подтвердите его. Ссылка действует 7 дней. Если вы не ожидали приглашение, проигнорируйте письмо.`,
        key: `invitation:${input.invitationId}:${input.token}`,
      })
    : ("not-configured" as const);
  return { delivery, link };
}
