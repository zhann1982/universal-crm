import assert from "node:assert/strict";
import test from "node:test";
import { actionFeedback, redirectFeedback } from "./feedback";

test("field validation stays inline, while operation failures and explicit success are announced", () => {
  assert.equal(actionFeedback({ errors: { name: ["Required"] }, message: "Check form" }), null);
  assert.deepEqual(actionFeedback({ message: "Conflict" }), { kind: "error", message: "Conflict" });
  assert.deepEqual(actionFeedback({ message: "Saved", success: true }), { kind: "success", message: "Saved" });
  assert.deepEqual(actionFeedback({ success: "Saved" }), { kind: "success", message: "Saved" });
});

test("invitation feedback never copies credentials or personal data from the result", () => {
  const feedback = actionFeedback({ status: "created", token: "private-token", email: "private@example.com" });
  assert.deepEqual(feedback, { kind: "success", message: "Приглашение создано." });
});

test("unknown redirect codes cannot inject notification text", () => {
  for (const value of ["__proto__", "constructor", "<script>alert(1)</script>", "private@example.com"]) {
    assert.equal(redirectFeedback("/crm", new URLSearchParams({ _notice: value })), null);
    assert.equal(redirectFeedback("/crm", new URLSearchParams({ error: value })), null);
  }
});

test("successful redirects and conflict redirects have distinct feedback", () => {
  assert.equal(redirectFeedback("/crm/clients", new URLSearchParams({ _notice: "client-created" }))?.kind, "success");
  assert.equal(redirectFeedback("/crm/deals/id", new URLSearchParams({ error: "stage-conflict" }))?.kind, "warning");
  assert.equal(redirectFeedback("/crm/team", new URLSearchParams({ error: "last-owner" }))?.kind, "error");
});

test("bulk partial failure cannot be reported as full success", () => {
  assert.equal(redirectFeedback("/crm/tasks", new URLSearchParams({ bulk: "done", updated: "3", conflicts: "1" }))?.kind, "warning");
  assert.equal(redirectFeedback("/crm/tasks", new URLSearchParams({ bulk: "done", updated: "0", conflicts: "0" }))?.kind, "warning");
  assert.equal(redirectFeedback("/crm/tasks", new URLSearchParams({ bulk: "done", updated: "3", conflicts: "0" }))?.kind, "success");
  assert.equal(redirectFeedback("/crm/tasks", new URLSearchParams({ bulk: "no-selection" }))?.kind, "warning");
});

test("bulk feedback is bounded and never echoes malformed counts", () => {
  assert.deepEqual(redirectFeedback("/crm/tasks", new URLSearchParams({ bulk: "done", updated: "Infinity", conflicts: "-5" })), {
    kind: "success", message: "Обновлено задач: 100. Конфликтов: 0.",
  });
  assert.equal(redirectFeedback("/crm/clients", new URLSearchParams({ bulk: "done" })), null);
});
