import type {
  ActivityEventDraft,
} from "./event-draft";

const STATUS_LABELS: Record<string, string> = {
  todo: "К выполнению",
  in_progress: "В работе",
  completed: "Выполнена",
  cancelled: "Отменена",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "Низкий",
  normal: "Обычный",
  high: "Высокий",
  urgent: "Срочный",
};

function sameDate(
  left: Date | null | undefined,
  right: Date | null | undefined,
) {
  return (
    left?.getTime() ?? null
  ) === (
    right?.getTime() ?? null
  );
}

function clip(
  value: string,
  maxLength = 180,
) {
  const normalized =
    value.trim();

  return normalized.length <= maxLength
    ? normalized
    : `${normalized.slice(0, maxLength - 1)}…`;
}

export function buildTaskCreatedEvents({
  status,
  priority,
  reminderAt,
  recurrenceFrequency,
}: {
  status: string;
  priority: string;
  reminderAt: Date | null;
  recurrenceFrequency: string;
}): ActivityEventDraft[] {
  const events: ActivityEventDraft[] = [
    {
      eventType: "task.created",
      summary: "Задача создана",
      details: `Статус: ${STATUS_LABELS[status] ?? status} · Приоритет: ${PRIORITY_LABELS[priority] ?? priority}`,
    },
  ];

  if (reminderAt) {
    events.push({
      eventType: "task.reminder_changed",
      summary: "Для задачи настроено напоминание",
    });
  }

  if (
    recurrenceFrequency !== "none"
  ) {
    events.push({
      eventType: "task.recurrence_changed",
      summary: "Для задачи настроено повторение",
    });
  }

  return events;
}

type TaskState = {
  title: string;
  description: string | null;
  status: string;
  priority: string;
  ownerMemberId: string | null;
  dueAt: Date | null;
  clientId: string | null;
  companyId: string | null;
  dealId: string | null;
};

type TaskScheduleState = {
  reminderAt: Date | null;
  recurrenceFrequency: string;
  recurrenceInterval: number;
  recurrenceEndAt: Date | null;
};

export function buildTaskUpdateEvents({
  previous,
  next,
  previousSchedule,
  nextSchedule,
}: {
  previous: TaskState;
  next: TaskState;
  previousSchedule:
    | TaskScheduleState
    | null;
  nextSchedule:
    TaskScheduleState;
}): ActivityEventDraft[] {
  const events: ActivityEventDraft[] = [];

  if (
    previous.title !== next.title
  ) {
    events.push({
      eventType: "task.title_changed",
      summary: "Название задачи изменено",
      details: `Новое название: ${clip(next.title)}`,
    });
  }

  if (
    previous.description !==
    next.description
  ) {
    events.push({
      eventType: "task.description_changed",
      summary: "Описание задачи изменено",
    });
  }

  if (
    previous.ownerMemberId !==
    next.ownerMemberId
  ) {
    events.push({
      eventType: "task.owner_changed",
      summary:
        next.ownerMemberId === null
          ? "Ответственный снят"
          : previous.ownerMemberId === null
            ? "Назначен ответственный"
            : "Ответственный изменён",
    });
  }

  if (
    previous.status !== next.status
  ) {
    if (
      next.status === "completed"
    ) {
      events.push(
        buildTaskLifecycleEvent(
          "complete",
        ),
      );
    } else if (
      previous.status ===
        "completed" &&
      next.status !==
        "cancelled"
    ) {
      events.push(
        buildTaskLifecycleEvent(
          "reopen",
        ),
      );
    } else if (
      next.status === "cancelled"
    ) {
      events.push(
        buildTaskLifecycleEvent(
          "cancel",
        ),
      );
    } else {
      events.push({
        eventType:
          "task.status_changed",
        summary:
          `Статус изменён: ${STATUS_LABELS[previous.status] ?? previous.status} → ${STATUS_LABELS[next.status] ?? next.status}`,
      });
    }
  }

  if (
    previous.priority !==
    next.priority
  ) {
    events.push({
      eventType:
        "task.priority_changed",
      summary:
        `Приоритет изменён: ${PRIORITY_LABELS[previous.priority] ?? previous.priority} → ${PRIORITY_LABELS[next.priority] ?? next.priority}`,
    });
  }

  if (
    !sameDate(
      previous.dueAt,
      next.dueAt,
    )
  ) {
    events.push({
      eventType:
        "task.due_at_changed",
      summary:
        next.dueAt === null
          ? "Срок задачи удалён"
          : previous.dueAt === null
            ? "Срок задачи установлен"
            : "Срок задачи изменён",
    });
  }

  if (
    previous.clientId !==
      next.clientId ||
    previous.companyId !==
      next.companyId ||
    previous.dealId !==
      next.dealId
  ) {
    events.push({
      eventType:
        "task.relations_changed",
      summary:
        "Изменены связи CRM",
    });
  }

  const oldReminder =
    previousSchedule?.reminderAt ??
    null;

  if (
    !sameDate(
      oldReminder,
      nextSchedule.reminderAt,
    )
  ) {
    events.push({
      eventType:
        "task.reminder_changed",
      summary:
        nextSchedule.reminderAt ===
        null
          ? "Напоминание удалено"
          : oldReminder === null
            ? "Напоминание установлено"
            : "Напоминание изменено",
    });
  }

  const oldFrequency =
    previousSchedule
      ?.recurrenceFrequency ??
    "none";
  const oldInterval =
    previousSchedule
      ?.recurrenceInterval ?? 1;
  const oldEndAt =
    previousSchedule
      ?.recurrenceEndAt ?? null;

  const recurrenceChanged =
    oldFrequency !==
      nextSchedule.recurrenceFrequency ||
    oldInterval !==
      nextSchedule.recurrenceInterval ||
    !sameDate(
      oldEndAt,
      nextSchedule.recurrenceEndAt,
    );

  if (recurrenceChanged) {
    events.push({
      eventType:
        "task.recurrence_changed",
      summary:
        nextSchedule.recurrenceFrequency ===
        "none"
          ? "Повторение задачи отключено"
          : oldFrequency === "none"
            ? "Повторение задачи включено"
            : "Настройки повторения изменены",
    });
  }

  return events;
}

export function buildTaskLifecycleEvent(
  action:
    | "todo"
    | "in_progress"
    | "complete"
    | "cancel"
    | "reopen"
    | "archive"
    | "restore"
    | "reminder_dismissed",
): ActivityEventDraft {
  switch (action) {
    case "todo":
      return {
        eventType:
          "task.status_changed",
        summary:
          "Статус установлен: К выполнению",
      };

    case "in_progress":
      return {
        eventType:
          "task.status_changed",
        summary:
          "Статус установлен: В работе",
      };

    case "complete":
      return {
        eventType: "task.completed",
        summary: "Задача выполнена",
      };

    case "cancel":
      return {
        eventType: "task.cancelled",
        summary: "Задача отменена",
      };

    case "reopen":
      return {
        eventType: "task.reopened",
        summary:
          "Задача возвращена в работу",
      };

    case "archive":
      return {
        eventType: "task.archived",
        summary: "Задача архивирована",
      };

    case "restore":
      return {
        eventType: "task.restored",
        summary: "Задача восстановлена",
      };

    case "reminder_dismissed":
      return {
        eventType:
          "task.reminder_dismissed",
        summary:
          "Напоминание скрыто",
      };
  }
}

export function buildBulkTaskEvent(
  action: string,
): ActivityEventDraft | null {
  if (
    action === "todo" ||
    action === "in_progress" ||
    action === "complete" ||
    action === "cancel" ||
    action === "archive" ||
    action === "restore"
  ) {
    return buildTaskLifecycleEvent(
      action,
    );
  }

  return null;
}
