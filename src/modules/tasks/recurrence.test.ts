import assert from "node:assert/strict";
import test from "node:test";

import {
  getNextRecurrenceDueAt,
  getNextReminderAt,
  shouldCreateNextOccurrence,
} from "./recurrence";

test(
  "daily recurrence keeps exact UTC time",
  () => {
    const next =
      getNextRecurrenceDueAt({
        dueAt: new Date(
          "2026-09-30T10:30:00.000Z",
        ),
        frequency: "daily",
        interval: 2,
      });

    assert.equal(
      next?.toISOString(),
      "2026-10-02T10:30:00.000Z",
    );
  },
);

test(
  "monthly recurrence clamps to last day of month",
  () => {
    const next =
      getNextRecurrenceDueAt({
        dueAt: new Date(
          "2027-01-31T08:00:00.000Z",
        ),
        frequency: "monthly",
        interval: 1,
      });

    assert.equal(
      next?.toISOString(),
      "2027-02-28T08:00:00.000Z",
    );
  },
);

test(
  "yearly recurrence clamps leap day",
  () => {
    const next =
      getNextRecurrenceDueAt({
        dueAt: new Date(
          "2028-02-29T12:00:00.000Z",
        ),
        frequency: "yearly",
        interval: 1,
      });

    assert.equal(
      next?.toISOString(),
      "2029-02-28T12:00:00.000Z",
    );
  },
);

test(
  "next reminder preserves lead time",
  () => {
    const nextReminder =
      getNextReminderAt({
        dueAt: new Date(
          "2026-10-01T10:00:00.000Z",
        ),
        reminderAt: new Date(
          "2026-10-01T08:00:00.000Z",
        ),
        nextDueAt: new Date(
          "2026-10-08T10:00:00.000Z",
        ),
      });

    assert.equal(
      nextReminder?.toISOString(),
      "2026-10-08T08:00:00.000Z",
    );
  },
);

test(
  "recurrence end date stops later occurrence",
  () => {
    assert.equal(
      shouldCreateNextOccurrence({
        nextDueAt: new Date(
          "2026-10-08T10:00:00.000Z",
        ),
        recurrenceEndAt: new Date(
          "2026-10-07T23:59:59.000Z",
        ),
      }),
      false,
    );
  },
);
