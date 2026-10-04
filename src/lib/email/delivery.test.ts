import assert from "node:assert/strict";
import test from "node:test";
import { sendEmail, invitationLink, deliverInvitation } from "./delivery";
test("email delivery reports provider acceptance, missing configuration and failures explicitly", async (t) => {
  const old = {
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
  };
  t.after(() => {
    for (const [key, value] of Object.entries(old)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;
  process.env.BETTER_AUTH_URL = "https://crm.example.com";
  const input = {
    to: "recipient@example.com",
    subject: "Test",
    text: "Private invitation",
    key: "invitation-key",
  };
  t.mock.method(globalThis, "fetch", () => {
    throw new Error("must not send");
  });
  assert.equal(await sendEmail(input), "not-configured");
  process.env.RESEND_API_KEY = "test-key";
  process.env.EMAIL_FROM = "CRM <crm@example.com>";
  const calls: { url: unknown; body: unknown; headers: unknown }[] = [];
  t.mock.method(
    globalThis,
    "fetch",
    async (url: unknown, options: RequestInit) => {
      calls.push({
        url,
        body: JSON.parse(String(options.body)),
        headers: options.headers,
      });
      return new Response(JSON.stringify({ id: "provider-id" }), {
        status: 200,
      });
    },
  );
  assert.equal(await sendEmail(input), "accepted");
  assert.equal(await sendEmail(input), "accepted");
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0], calls[1]);
  assert.deepEqual((calls[0].body as { to: string[] }).to, [
    "recipient@example.com",
  ]);
  t.mock.method(
    globalThis,
    "fetch",
    async () => new Response("Invalid key", { status: 401 }),
  );
  assert.equal(await sendEmail(input), "failed");
  t.mock.method(globalThis, "fetch", async () => {
    throw new Error("private provider error");
  });
  assert.equal(await sendEmail(input), "failed");
  const delivered = await deliverInvitation({
    invitationId: "id",
    email: input.to,
    token: "token",
    organizationName: "Test",
  });
  assert.equal(delivered.delivery, "failed");
  assert.equal(delivered.link, "https://crm.example.com/invite?token=token");
  process.env.BETTER_AUTH_URL = "javascript:alert(1)";
  assert.equal(invitationLink("token"), null);
});
