import assert from "node:assert/strict";
import test from "node:test";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { migrationState } from "./migration-state";
test("read-only migration preflight detects pending files, altered journal and safe complete replay", async () => {
  const files = readMigrationFiles({ migrationsFolder: "drizzle" });
  const rows = files.map((f) => ({ hash: f.hash, created_at: f.folderMillis }));
  assert.deepEqual((await migrationState(rows)).pending, []);
  assert.deepEqual((await migrationState(rows.slice(0, 17))).pending, [
    "0017_task_activity_integrity",
    "0018_bounded_read_indexes",
    "0019_custom_fields",
  ]);
  await assert.rejects(migrationState([{ ...rows[0], hash: "altered" }]));
  await assert.rejects(migrationState([{ ...rows[0], created_at: 0 }]));
  await assert.rejects(migrationState(rows.slice(1)));
});
