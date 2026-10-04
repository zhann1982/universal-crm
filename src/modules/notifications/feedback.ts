export type Feedback = { kind: "success" | "error" | "warning"; message: string };

export const notices = {
  "client-created": "Клиент создан.", "client-updated": "Изменения клиента сохранены.",
  "client-archived": "Клиент перемещён в архив.", "client-restored": "Клиент восстановлен.",
  "company-created": "Компания создана.", "company-updated": "Изменения компании сохранены.",
  "company-archived": "Компания перемещена в архив.", "company-restored": "Компания восстановлена.",
  "deal-created": "Сделка создана.", "deal-updated": "Изменения сделки сохранены.",
  "deal-archived": "Сделка перемещена в архив.", "deal-restored": "Сделка восстановлена.",
  "deal-stage": "Этап сделки сохранён.",
  "task-created": "Задача создана.", "task-updated": "Изменения задачи сохранены.",
  "task-completed": "Задача выполнена.", "task-reopened": "Задача возвращена в работу.",
  "task-archived": "Задача перемещена в архив.", "task-restored": "Задача восстановлена.",
  "reminder-dismissed": "Напоминание скрыто.",
  "member-status": "Статус сотрудника сохранён.", "member-roles": "Роли сотрудника сохранены.",
  "company-linked": "Связь с компанией сохранена.", "company-unlinked": "Связь с компанией удалена.",
  "organization-created": "Организация создана.",
} as const;
export type Notice = keyof typeof notices;

// Only fixed messages enter redirect feedback; query values never become notification text.
export function redirectFeedback(path: string, query: URLSearchParams): Feedback | null {
  const notice = query.get("_notice");
  if (notice && Object.hasOwn(notices, notice)) return { kind: "success", message: notices[notice as Notice] };
  const error = query.get("error");
  if (error && path.startsWith("/crm")) {
    const messages: Record<string, string> = {
      conflict: "Запись изменилась или недоступна. Проверьте актуальные данные и повторите действие.",
      "stage-conflict": "Сделка изменилась. Проверьте актуальные данные и повторите смену этапа.",
      "lifecycle-conflict": "Состояние записи изменилось или восстановление недоступно. Проверьте актуальные данные.",
      "stage-error": "Не удалось изменить этап сделки. Повторите попытку.",
      self: "Нельзя изменять собственные роли.", "self-status": "Нельзя деактивировать собственную учётную запись.",
      "last-owner": "Нельзя удалить или деактивировать последнего активного владельца организации.",
      member: "Сотрудник недоступен.", role: "Одна из выбранных ролей недоступна.",
      invalid: "Проверьте выбранные роли.", "status-invalid": "Некорректный статус сотрудника.",
    };
    if (Object.hasOwn(messages, error)) return { kind: error.includes("conflict") ? "warning" : "error", message: messages[error] };
  }
  if (path === "/crm/tasks" && query.get("bulk") === "no-selection") return { kind: "warning", message: "Выберите задачи для изменения." };
  if (path === "/crm/tasks" && query.get("bulk") === "done") {
    const count = (key: string) => Math.min(100, Math.max(0, Number(query.get(key)) || 0));
    const updated = count("updated"), conflicts = count("conflicts");
    return { kind: conflicts || !updated ? "warning" : "success", message: `Обновлено задач: ${updated}. Конфликтов: ${conflicts}.` };
  }
  return null;
}

export function actionFeedback(state: unknown): Feedback | null {
  if (!state || typeof state !== "object") return null;
  const result = state as { message?: unknown; error?: unknown; success?: unknown; status?: unknown; errors?: unknown };
  if (result.status === "created") return { kind: "success", message: "Приглашение создано." };
  if (typeof result.error === "string") return { kind: "error", message: result.error };
  if (typeof result.success === "string") return { kind: "success", message: result.success };
  // Field validation remains next to the fields, without a second transient error.
  if (result.errors && Object.keys(result.errors).length) return null;
  if (typeof result.message === "string") return { kind: result.success === true ? "success" : "error", message: result.message };
  return null;
}
