import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as crmSchema from "./schema";
import * as authSchema from "./auth-schema";
import * as taskSchedulingSchema from "./task-scheduling-schema";
import * as activitySchema from "./activity-schema";

const databaseUrl =
  process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is not defined",
  );
}

/*
 * Raw Neon HTTP query function.
 *
 * Exported intentionally for the small number of cases where we need
 * a non-interactive PostgreSQL transaction through sql.transaction(...).
 *
 * Normal application queries should continue to use `db`.
 */
export const sql =
  neon(databaseUrl);

const schema = {
  ...crmSchema,
  ...authSchema,
  ...taskSchedulingSchema,
  ...activitySchema,
};

export const db = drizzle(sql, {
  schema,
});
