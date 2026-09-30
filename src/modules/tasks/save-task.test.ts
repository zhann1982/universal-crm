import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

// No external database is used. Execute production SQL against embedded PostgreSQL.
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/unused";

test("task persistence is atomic in PostgreSQL", async (t) => {
  const pg = new PGlite();
  t.after(() => pg.close());
  for (const name of (await readdir("drizzle")).filter((name) => name.endsWith(".sql")).sort()) {
    await pg.exec(await readFile(`drizzle/${name}`, "utf8"));
  }
  const { sql } = await import("@/db");
  const { saveTask, completeTaskRecord } = await import("./save-task");
  const { changeTaskState, dismissReminder } = await import("./change-task-state");
  t.mock.method(sql, "query", async (query: string, params: unknown[], options?: { arrayMode?: boolean; fullResults?: boolean }) => {
    const result = await pg.query(query, params);
    // Drizzle requests array rows; raw Neon SQL requests plain object rows.
    if (options?.arrayMode) {
      return { ...result, rows: result.rows.map((row) => result.fields.map((field) => (row as Record<string, unknown>)[field.name])) };
    }
    return options?.fullResults ? result : result.rows;
  });
  const organizationId = randomUUID();
  const actorMemberId = randomUUID();
  await pg.query("INSERT INTO organizations (id, name, slug) VALUES ($1, 'Test', $2)", [organizationId, randomUUID()]);
  await pg.query("INSERT INTO organization_members (id, organization_id, user_id, display_name) VALUES ($1, $2, $3, 'Tester')", [actorMemberId, organizationId, randomUUID()]);

  function draft() {
    return {
      taskId: randomUUID(), organizationId, actorMemberId,
      expectedVersion: null as number | null, expectedScheduleVersion: null as number | null,
      task: { title: "Call", description: null, status: "todo", priority: "normal",
        ownerMemberId: null, clientId: null, companyId: null, dealId: null,
        dueAt: new Date("2026-10-01T10:00:00Z") },
      schedule: { reminderAt: new Date("2026-10-01T09:00:00Z"), recurrenceFrequency: "daily",
        recurrenceInterval: 1, recurrenceEndAt: null, recurrenceSeriesId: null, recurrenceSequence: 1 },
      events: [{ eventType: "task.created", summary: "Created" }], createNextOccurrence: false,
    };
  }
  async function snapshot(id: string) {
    return (await pg.query("SELECT row_to_json(t) AS task, row_to_json(s) AS schedule FROM tasks t JOIN task_schedules s ON s.task_id = t.id WHERE t.id = $1", [id])).rows;
  }
  async function counts() {
    return (await pg.query("SELECT (SELECT count(*) FROM tasks) AS tasks, (SELECT count(*) FROM task_schedules) AS schedules, (SELECT count(*) FROM activity_events) AS events")).rows;
  }

  await t.test("creation stores task, schedule and history together", async () => {
    const input = draft();
    assert.equal((await saveTask(input))?.id, input.taskId);
    assert.equal((await snapshot(input.taskId)).length, 1);
    const events = await pg.query("SELECT event_type FROM activity_events WHERE entity_id = $1", [input.taskId]);
    assert.deepEqual(events.rows, [{ event_type: "task.created" }]);
  });

  await t.test("history failure rolls back task and schedule creation", async () => {
    const input = draft();
    input.events[0].summary = "x".repeat(241);
    const before = await counts();
    await assert.rejects(saveTask(input), /value too long/);
    assert.deepEqual(await counts(), before);
  });

  await t.test("stale task or schedule version causes no writes", async () => {
    const input = draft(); await saveTask(input);
    const before = await snapshot(input.taskId);
    const beforeCounts = await counts();
    for (const [expectedVersion, expectedScheduleVersion] of [[2, 1], [1, 2], [1, null]]) {
      assert.equal(await saveTask({ ...input, expectedVersion, expectedScheduleVersion, task: { ...input.task, title: "Changed" } }), null);
    }
    assert.deepEqual(await snapshot(input.taskId), before);
    assert.deepEqual(await counts(), beforeCounts);
  });

  await t.test("history failure rolls back edit, completion and the next recurrence", async () => {
    const input = draft(); await saveTask(input);
    const before = await snapshot(input.taskId);
    const beforeCounts = await counts();
    await assert.rejects(saveTask({ ...input, expectedVersion: 1, expectedScheduleVersion: 1,
      task: { ...input.task, status: "completed", title: "Changed" }, createNextOccurrence: true,
      events: [{ eventType: "task.completed", summary: "x".repeat(241) }],
    }), /value too long/);
    assert.deepEqual(await snapshot(input.taskId), before);
    assert.deepEqual(await counts(), beforeCounts);
  });

  await t.test("completion creates one successor and records both histories", async () => {
    const input = draft(); await saveTask(input);
    const result = await completeTaskRecord({ taskId: input.taskId, organizationId, actorMemberId, expectedVersion: 1 });
    assert.ok(result?.nextTaskId);
    const next = await pg.query("SELECT t.status, t.due_at, s.recurrence_sequence FROM tasks t JOIN task_schedules s ON s.task_id = t.id WHERE t.id = $1", [result.nextTaskId]);
    assert.equal((next.rows[0] as { status: string }).status, "todo");
    assert.equal((next.rows[0] as { recurrence_sequence: number }).recurrence_sequence, 2);
    assert.equal(new Date((next.rows[0] as { due_at: string }).due_at).toISOString(), "2026-10-02T10:00:00.000Z");
    const before = await counts();
    assert.equal(await completeTaskRecord({ taskId: input.taskId, organizationId, actorMemberId, expectedVersion: 1 }), null);
    assert.deepEqual(await counts(), before);
    const events = await pg.query("SELECT event_type FROM activity_events WHERE entity_id IN ($1, $2) ORDER BY event_type", [input.taskId, result.nextTaskId]);
    assert.deepEqual(events.rows.map((row) => (row as { event_type: string }).event_type), ["task.completed", "task.created", "task.created", "task.recurrence_next_created"]);
  });

  await t.test("reopen then complete does not duplicate an existing successor", async () => {
    const input = draft(); await saveTask(input);
    await completeTaskRecord({ taskId: input.taskId, organizationId, actorMemberId, expectedVersion: 1 });
    await saveTask({ ...input, expectedVersion: 2, expectedScheduleVersion: 2 });
    const result = await completeTaskRecord({ taskId: input.taskId, organizationId, actorMemberId, expectedVersion: 3 });
    assert.ok(result);
    assert.equal(result.nextTaskId, null);
    const series = await pg.query("SELECT count(*)::integer AS total FROM task_schedules WHERE recurrence_series_id = $1", [input.taskId]);
    assert.deepEqual(series.rows, [{ total: 2 }]);
  });

  await t.test("an unrelated edit preserves an already dismissed reminder", async () => {
    const input = draft(); await saveTask(input);
    await pg.query("UPDATE task_schedules SET reminder_dismissed_at = '2026-10-01T09:30:00Z', version = 2 WHERE task_id = $1", [input.taskId]);
    assert.equal(await saveTask({ ...input, expectedVersion: 1, expectedScheduleVersion: 1 }), null);
    assert.ok(await saveTask({ ...input, expectedVersion: 1, expectedScheduleVersion: 2 }));
    const result = await pg.query("SELECT reminder_dismissed_at IS NOT NULL AS dismissed FROM task_schedules WHERE task_id = $1", [input.taskId]);
    assert.deepEqual(result.rows, [{ dismissed: true }]);
  });

  await t.test("archived and foreign-tenant tasks cannot be changed", async () => {
    const input = draft(); await saveTask(input);
    assert.equal(await saveTask({ ...input, organizationId: randomUUID(), expectedVersion: 1, expectedScheduleVersion: 1 }), null);
    await pg.query("UPDATE tasks SET is_archived = true WHERE id = $1", [input.taskId]);
    assert.equal(await saveTask({ ...input, expectedVersion: 1, expectedScheduleVersion: 1 }), null);
  });

  await t.test("a schedule error rolls back completion and successor creation", async () => {
    const input = draft(); await saveTask(input);
    const before = await snapshot(input.taskId);
    const beforeCounts = await counts();
    await pg.exec("ALTER TABLE task_schedules ADD CONSTRAINT test_no_successor CHECK (recurrence_sequence < 2) NOT VALID");
    try {
      await assert.rejects(completeTaskRecord({ taskId: input.taskId, organizationId, actorMemberId, expectedVersion: 1 }), /test_no_successor/);
      assert.deepEqual(await snapshot(input.taskId), before);
      assert.deepEqual(await counts(), beforeCounts);
    } finally {
      await pg.exec("ALTER TABLE task_schedules DROP CONSTRAINT test_no_successor");
    }
  });

  await t.test("created completed tasks have a completion timestamp; recurrence respects its end", async () => {
    const input = draft(); input.task.status = "completed";
    const result = await saveTask({ ...input, createNextOccurrence: true,
      schedule: { ...input.schedule, recurrenceEndAt: input.task.dueAt } });
    assert.equal(result?.nextTaskId, null);
    const task = await pg.query("SELECT completed_at IS NOT NULL AS completed FROM tasks WHERE id = $1", [input.taskId]);
    assert.deepEqual(task.rows, [{ completed: true }]);
  });

  await t.test("lifecycle operations preserve status semantics and reject stale writes", async () => {
    const input = draft(); await saveTask(input);
    const base = { taskId: input.taskId, organizationId, actorMemberId };
    for (const [index, action] of (["archive", "restore", "in_progress", "cancel", "todo"] as const).entries()) {
      assert.ok(await changeTaskState({ ...base, expectedVersion: index + 1, action }));
      assert.equal(await changeTaskState({ ...base, expectedVersion: index + 1, action }), null);
    }
    assert.equal(await changeTaskState({ ...base, expectedVersion: 6, action: "reopen" }), null);
    const row = await pg.query("SELECT status, is_archived, version FROM tasks WHERE id = $1", [input.taskId]);
    assert.deepEqual(row.rows, [{ status: "todo", is_archived: false, version: 6 }]);
  });

  await t.test("lifecycle and reminder writes roll back when history fails", async () => {
    const input = draft(); await saveTask(input);
    const before = await snapshot(input.taskId);
    const beforeCounts = await counts();
    await pg.exec("ALTER TABLE activity_events ADD CONSTRAINT test_history_failure CHECK (event_type NOT IN ('task.archived', 'task.reminder_dismissed')) NOT VALID");
    try {
      const base = { taskId: input.taskId, organizationId, actorMemberId, expectedVersion: 1 };
      await assert.rejects(changeTaskState({ ...base, action: "archive" }), /test_history_failure/);
      await assert.rejects(dismissReminder(base), /test_history_failure/);
      assert.deepEqual(await snapshot(input.taskId), before);
      assert.deepEqual(await counts(), beforeCounts);
    } finally {
      await pg.exec("ALTER TABLE activity_events DROP CONSTRAINT test_history_failure");
    }
  });

  await t.test("reminder dismissal checks tenant, parent lifecycle and schedule version", async () => {
    const input = draft(); await saveTask(input);
    const base = { taskId: input.taskId, organizationId, actorMemberId, expectedVersion: 1 };
    assert.equal(await dismissReminder({ ...base, organizationId: randomUUID() }), null);
    assert.ok(await changeTaskState({ ...base, action: "archive" }));
    assert.equal(await dismissReminder(base), null);
    assert.ok(await changeTaskState({ ...base, expectedVersion: 2, action: "restore" }));
    assert.ok(await dismissReminder(base));
    assert.equal(await dismissReminder(base), null);
    const events = await pg.query("SELECT count(*)::integer AS total FROM activity_events WHERE entity_id = $1 AND event_type = 'task.reminder_dismissed'", [input.taskId]);
    assert.deepEqual(events.rows, [{ total: 1 }]);
  });
});
