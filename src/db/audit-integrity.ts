import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not defined");
  const sql = neon(url);
  const query = await readFile(new URL("./integrity-audit.sql", import.meta.url), "utf8");
  // One SELECT produces a consistent snapshot. This tool never changes rows or schema.
  const rows = await sql.query(query) as { invariant: string; violations: number }[];
  console.table(rows);
  if (rows.some((row) => row.violations > 0)) {
    console.error("Integrity violations found. Review and repair deliberately before migrating; no data was changed.");
    process.exitCode = 1;
  }
}

main().catch(() => {
  // Driver errors can contain connection details; never print them here.
  console.error("Integrity audit failed. Check database configuration and connectivity.");
  process.exitCode = 1;
});
