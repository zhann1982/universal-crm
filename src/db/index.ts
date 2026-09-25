import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as crmSchema from "./schema";
import * as authSchema from "./auth-schema";

const databaseUrl =
  process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is not defined",
  );
}

const sql = neon(databaseUrl);

const schema = {
  ...crmSchema,
  ...authSchema,
};

export const db = drizzle(sql, {
  schema,
});