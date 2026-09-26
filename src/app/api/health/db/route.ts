import {
  sql,
} from "drizzle-orm";

import { db } from "@/db";

export const dynamic =
  "force-dynamic";

export async function GET() {
  try {
    /*
     * Публичный health endpoint
     * проверяет только возможность
     * выполнить лёгкий запрос к БД.
     *
     * Никакие CRM-счётчики,
     * tenant-данные или внутренние
     * сведения здесь не возвращаются.
     */
    await db.execute(
      sql`select 1`,
    );

    return Response.json(
      {
        ok: true,
        database:
          "connected",
      },
      {
        status: 200,

        headers: {
          "Cache-Control":
            "no-store, max-age=0",
        },
      },
    );
  } catch (error) {
    /*
     * Ошибка остаётся только
     * в серверном журнале.
     *
     * Клиенту не отдаём текст
     * SQL/DB ошибки.
     */
    console.error(
      "Database health check failed:",
      error instanceof Error
        ? error.message
        : "Unknown database error",
    );

    return Response.json(
      {
        ok: false,
        database:
          "unavailable",
      },
      {
        status: 503,

        headers: {
          "Cache-Control":
            "no-store, max-age=0",
        },
      },
    );
  }
}