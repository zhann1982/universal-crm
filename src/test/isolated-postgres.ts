import { readdir, readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import type { TestContext } from "node:test";
export async function isolatedPostgres(t: TestContext) {
  const pg = new PGlite();
  t.after(() => pg.close());
  for (const file of (await readdir("drizzle"))
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await pg.exec(await readFile(`drizzle/${file}`, "utf8"));
  const { sql } = await import("@/db");
  type Statement = { query: string; params: unknown[] };
  type Options = { arrayMode?: boolean; fullResults?: boolean };
  function shape(
    result: Awaited<ReturnType<typeof pg.query>>,
    options: Options = {},
  ) {
    const rows = options.arrayMode
      ? result.rows.map((row) =>
          result.fields.map(
            (field) => (row as Record<string, unknown>)[field.name],
          ),
        )
      : result.rows;
    return options.fullResults ? { ...result, rows } : rows;
  }
  t.mock.method(
    sql,
    "query",
    async (query: string, params: unknown[], options: Options) =>
      shape(await pg.query(query, params), options),
  );
  t.mock.method(
    sql,
    "transaction",
    async (build: (tx: unknown) => Statement[], options: Options) => {
      const tx = Object.assign(
        (strings: TemplateStringsArray, ...params: unknown[]) => ({
          query: strings.reduce(
            (s, part, index) =>
              s + part + (index < params.length ? `$${index + 1}` : ""),
            "",
          ),
          params,
        }),
        { query: (query: string, params: unknown[]) => ({ query, params }) },
      );
      const statements = build(tx);
      return pg.transaction(async (transaction) => {
        const results = [];
        for (const statement of statements)
          results.push(
            shape(
              await transaction.query(statement.query, statement.params),
              options,
            ),
          );
        return results;
      });
    },
  );
  return pg;
}
