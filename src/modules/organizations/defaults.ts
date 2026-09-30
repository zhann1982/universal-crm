import { PERMISSIONS } from "@/modules/access/permission-catalog";

export const DEFAULT_ROLES = [
    {
      name: "Owner",
      systemKey: "owner",
      description:
        "Полный доступ к организации",

      permissions:
        PERMISSIONS.map(
          (item) => item.key,
        ),
    },

    {
      name: "Admin",
      systemKey: "admin",
      description:
        "Администрирование CRM",

      permissions:
        PERMISSIONS.map(
          (item) => item.key,
        ),
    },

    {
      name: "Manager",
      systemKey: "manager",
      description:
        "Работа с клиентами",

      permissions: [
        "clients.read",
        "clients.create",
        "clients.update",
        "clients.archive",

        "companies.read",
        "companies.create",
        "companies.update",
        "companies.archive",

        "deals.read",
        "deals.create",
        "deals.update",
        "deals.archive",

        "tasks.read",
        "tasks.create",
        "tasks.update",
        "tasks.archive",
        "comments.read",
        "comments.create",
        "comments.update",
        "comments.archive",
        "activity.read",


        "pipelines.read",
      ],
    },

    {
      name: "Viewer",
      systemKey: "viewer",
      description:
        "Только просмотр",

      permissions: [
        "clients.read",
        "companies.read",
        "deals.read",
        "tasks.read",
        "comments.read",
        "activity.read",

        "pipelines.read",
      ],
    },
  ] as const;


export const DEFAULT_STAGES = [
    {
      name: "Новая",
      type: "open",
      position: 10,
      probability: 10,
    },
    {
      name: "Квалификация",
      type: "open",
      position: 20,
      probability: 25,
    },
    {
      name: "Предложение",
      type: "open",
      position: 30,
      probability: 50,
    },
    {
      name: "Переговоры",
      type: "open",
      position: 40,
      probability: 75,
    },
    {
      name: "Выиграна",
      type: "won",
      position: 50,
      probability: 100,
    },
    {
      name: "Проиграна",
      type: "lost",
      position: 60,
      probability: 0,
    },
  ] as const;
