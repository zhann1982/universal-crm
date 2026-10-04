import { neon } from "@neondatabase/serverless";
import { migrationState } from "./migration-state";
async function main() {
  if (!process.env.DATABASE_URL)
    throw new Error("Database configuration missing");
  const sql = neon(process.env.DATABASE_URL);
  const [exists] = await sql.query(
    "SELECT to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS present",
  );
  const rows = exists.present
    ? await sql.query(
        "SELECT hash,created_at FROM drizzle.__drizzle_migrations ORDER BY created_at",
      )
    : [];
  const state = await migrationState(
    rows as { hash: string; created_at: number | string }[],
  );
  console.log(`Applied migrations: ${state.applied}/${state.total}`);
  console.log(
    state.pending.length
      ? `Pending: ${state.pending.join(", ")}`
      : "All migration hashes match; no pending migrations.",
  );
  if (state.pending.length) process.exitCode = 1;
}
main().catch(() => {
  console.error(
    "Cannot verify migration state. Check connectivity and journal alignment; no data was changed.",
  );
  process.exitCode = 1;
});
