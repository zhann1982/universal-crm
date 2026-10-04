import { readMigrationFiles } from "drizzle-orm/migrator";
import { readFile } from "node:fs/promises";
export async function migrationState(
  applied: { hash: string; created_at: number | string }[],
) {
  const migrations = readMigrationFiles({ migrationsFolder: "drizzle" });
  const journal = JSON.parse(
    await readFile("drizzle/meta/_journal.json", "utf8"),
  ) as { entries: { tag: string; when: number }[] };
  const ordered = [...applied].sort(
    (a, b) => Number(a.created_at) - Number(b.created_at),
  );
  for (let i = 0; i < ordered.length; i++) {
    if (
      !migrations[i] ||
      ordered[i].hash !== migrations[i].hash ||
      Number(ordered[i].created_at) !== migrations[i].folderMillis
    )
      throw new Error(
        "Migration journal differs from repository; do not migrate until reviewed.",
      );
  }
  return {
    applied: ordered.length,
    total: migrations.length,
    pending: journal.entries.slice(ordered.length).map((e) => e.tag),
  };
}
