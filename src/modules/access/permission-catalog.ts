export const PERMISSIONS = [
  {
    key: "clients.read",
    name: "Просмотр клиентов",
  },
  {
    key: "clients.create",
    name: "Создание клиентов",
  },
  {
    key: "clients.update",
    name: "Изменение клиентов",
  },
  {
    key: "clients.archive",
    name: "Архивация клиентов",
  },
  {
    key: "clients.delete",
    name: "Удаление клиентов",
  },
  {
    key: "companies.read",
    name: "Просмотр компаний",
  },
  {
    key: "companies.create",
    name: "Создание компаний",
  },
  {
    key: "companies.update",
    name: "Изменение компаний",
  },
  {
    key: "companies.archive",
    name: "Архивация компаний",
  },
  {
    key: "companies.delete",
    name: "Удаление компаний",
  },
  {
    key: "deals.read",
    name: "Просмотр сделок",
  },
  {
    key: "deals.create",
    name: "Создание сделок",
  },
  {
    key: "deals.update",
    name: "Изменение сделок",
  },
  {
    key: "deals.archive",
    name: "Архивация сделок",
  },
  {
    key: "deals.delete",
    name: "Удаление сделок",
  },
    {
    key: "tasks.read",
    name: "Просмотр задач",
  },
  {
    key: "tasks.create",
    name: "Создание задач",
  },
  {
    key: "tasks.update",
    name: "Изменение задач",
  },
  {
    key: "tasks.archive",
    name: "Архивация задач",
  },
  {
    key: "tasks.delete",
    name: "Удаление задач",
  },
  {
    key: "comments.read",
    name: "Просмотр комментариев",
  },
  {
    key: "comments.create",
    name: "Создание комментариев",
  },
  {
    key: "comments.update",
    name: "Изменение комментариев",
  },
  {
    key: "comments.archive",
    name: "Архивация комментариев",
  },
  {
    key: "comments.manage",
    name: "Управление чужими комментариями",
  },
  {
    key: "activity.read",
    name: "Просмотр истории CRM",
  },
  {
    key: "pipelines.read",
    name: "Просмотр воронок",
  },
  {
    key: "pipelines.manage",
    name: "Управление воронками",
  },
  {
    key: "members.read",
    name: "Просмотр сотрудников",
  },
  {
    key: "members.manage",
    name: "Управление сотрудниками",
  },
  {
    key: "roles.read",
    name: "Просмотр ролей",
  },
  {
    key: "roles.manage",
    name: "Управление ролями",
  },
  {
    key: "settings.manage",
    name: "Управление настройками",
  },
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number]["key"];
