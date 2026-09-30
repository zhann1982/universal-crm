import assert from "node:assert/strict";
import test from "node:test";

import {
  buildTaskCreatedEvents,
  buildTaskLifecycleEvent,
  buildTaskUpdateEvents,
} from "./task-activity";

const baseTask = {
  title: "Позвонить клиенту",
  description: null,
  status: "todo",
  priority: "normal",
  ownerMemberId: null,
  dueAt: null,
  clientId: null,
  companyId: null,
  dealId: null,
};

const baseSchedule = {
  reminderAt: null,
  recurrenceFrequency: "none",
  recurrenceInterval: 1,
  recurrenceEndAt: null,
};

test(
  "created task records creation and optional scheduling",
  () => {
    const events =
      buildTaskCreatedEvents({
        status: "todo",
        priority: "urgent",
        reminderAt:
          new Date(
            "2026-10-01T05:00:00Z",
          ),
        recurrenceFrequency:
          "weekly",
      });

    assert.deepEqual(
      events.map(
        (event) => event.eventType,
      ),
      [
        "task.created",
        "task.reminder_changed",
        "task.recurrence_changed",
      ],
    );
  },
);

test(
  "unchanged task produces no update events",
  () => {
    const events =
      buildTaskUpdateEvents({
        previous: baseTask,
        next: baseTask,
        previousSchedule:
          baseSchedule,
        nextSchedule:
          baseSchedule,
      });

    assert.equal(
      events.length,
      0,
    );
  },
);

test(
  "completion is recorded as lifecycle event",
  () => {
    const events =
      buildTaskUpdateEvents({
        previous: baseTask,
        next: {
          ...baseTask,
          status: "completed",
        },
        previousSchedule:
          baseSchedule,
        nextSchedule:
          baseSchedule,
      });

    assert.equal(
      events[0]?.eventType,
      "task.completed",
    );
  },
);

test(
  "field and schedule changes create separate events",
  () => {
    const events =
      buildTaskUpdateEvents({
        previous: baseTask,
        next: {
          ...baseTask,
          priority: "high",
          dueAt:
            new Date(
              "2026-10-01T10:00:00Z",
            ),
          ownerMemberId:
            "11111111-1111-4111-8111-111111111111",
        },
        previousSchedule:
          baseSchedule,
        nextSchedule: {
          ...baseSchedule,
          reminderAt:
            new Date(
              "2026-10-01T09:00:00Z",
            ),
        },
      });

    const types = new Set(
      events.map(
        (event) => event.eventType,
      ),
    );

    assert.equal(
      types.has(
        "task.priority_changed",
      ),
      true,
    );
    assert.equal(
      types.has(
        "task.due_at_changed",
      ),
      true,
    );
    assert.equal(
      types.has(
        "task.owner_changed",
      ),
      true,
    );
    assert.equal(
      types.has(
        "task.reminder_changed",
      ),
      true,
    );
  },
);

test(
  "lifecycle helper maps archive and restore",
  () => {
    assert.equal(
      buildTaskLifecycleEvent(
        "archive",
      ).eventType,
      "task.archived",
    );

    assert.equal(
      buildTaskLifecycleEvent(
        "restore",
      ).eventType,
      "task.restored",
    );
  },
);
