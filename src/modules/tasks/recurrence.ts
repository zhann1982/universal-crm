export type TaskRecurrenceFrequency =
  | "none"
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly";

export function getNextRecurrenceDueAt({
  dueAt,
  frequency,
  interval,
}: {
  dueAt: Date;
  frequency: TaskRecurrenceFrequency;
  interval: number;
}) {
  const safeInterval = Math.max(
    1,
    Math.trunc(interval),
  );

  if (frequency === "none") {
    return null;
  }

  const next = new Date(
    dueAt.getTime(),
  );

  if (frequency === "daily") {
    next.setUTCDate(
      next.getUTCDate() +
        safeInterval,
    );
    return next;
  }

  if (frequency === "weekly") {
    next.setUTCDate(
      next.getUTCDate() +
        safeInterval * 7,
    );
    return next;
  }

  if (frequency === "monthly") {
    return addUtcMonthsClamped(
      next,
      safeInterval,
    );
  }

  return addUtcYearsClamped(
    next,
    safeInterval,
  );
}

export function getNextReminderAt({
  dueAt,
  reminderAt,
  nextDueAt,
}: {
  dueAt: Date;
  reminderAt: Date | null;
  nextDueAt: Date;
}) {
  if (!reminderAt) {
    return null;
  }

  const leadTime =
    dueAt.getTime() -
    reminderAt.getTime();

  return new Date(
    nextDueAt.getTime() -
      Math.max(0, leadTime),
  );
}

export function shouldCreateNextOccurrence({
  nextDueAt,
  recurrenceEndAt,
}: {
  nextDueAt: Date | null;
  recurrenceEndAt: Date | null;
}) {
  if (!nextDueAt) {
    return false;
  }

  if (!recurrenceEndAt) {
    return true;
  }

  return (
    nextDueAt.getTime() <=
    recurrenceEndAt.getTime()
  );
}

function addUtcMonthsClamped(
  value: Date,
  months: number,
) {
  const originalDay =
    value.getUTCDate();

  const targetMonthIndex =
    value.getUTCMonth() + months;

  const targetYear =
    value.getUTCFullYear() +
    Math.floor(targetMonthIndex / 12);

  const targetMonth =
    ((targetMonthIndex % 12) +
      12) %
    12;

  const lastDay =
    new Date(
      Date.UTC(
        targetYear,
        targetMonth + 1,
        0,
      ),
    ).getUTCDate();

  const result = new Date(
    value.getTime(),
  );

  result.setUTCFullYear(
    targetYear,
    targetMonth,
    Math.min(
      originalDay,
      lastDay,
    ),
  );

  return result;
}

function addUtcYearsClamped(
  value: Date,
  years: number,
) {
  const targetYear =
    value.getUTCFullYear() + years;

  const month =
    value.getUTCMonth();

  const originalDay =
    value.getUTCDate();

  const lastDay =
    new Date(
      Date.UTC(
        targetYear,
        month + 1,
        0,
      ),
    ).getUTCDate();

  const result = new Date(
    value.getTime(),
  );

  result.setUTCFullYear(
    targetYear,
    month,
    Math.min(
      originalDay,
      lastDay,
    ),
  );

  return result;
}
