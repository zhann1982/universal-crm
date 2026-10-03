import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { getActivityActor } from "@/modules/activity/mutation-context";

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

// Preserve Drizzle's result shape, including arrayMode and fullResults. Identity
// and the business statement use one Neon transaction; its trigger writes Activity.
// Raw SQL Task/Comment operations retain their existing atomic implementations.
const activityClient = new Proxy(sql, {
  get(target, property) {
    if (property !== "query") return Reflect.get(target, property);
    return async (...args: Parameters<typeof sql.query>) => {
      const actor = getActivityActor();
      const [query, params, options] = args;
      if (!actor || !/^\s*(insert|update)\b/i.test(query)) return target.query(...args);
      const results = await target.transaction(tx => [
        tx.query("SELECT set_config('crm.activity_actor', $1, true), set_config('crm.activity_organization', $2, true)",
          [actor.memberId, actor.organizationId]),
        tx.query(query, params),
      ], options);
      return results[1];
    };
  },
});

export const db = drizzle(activityClient, {
  schema,
});
