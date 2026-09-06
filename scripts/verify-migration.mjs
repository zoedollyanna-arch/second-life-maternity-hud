// Applies a migration inside a transaction and ROLLS IT BACK.
//
// Proves the SQL parses and applies against the real current schema without
// leaving anything behind. Useful before deploying, because the app runs
// migrations automatically on boot and a broken one takes the site with it.
//
//   node --env-file=.env scripts/verify-migration.mjs db/migrations/0008_partner_system.sql

import { readFile } from "node:fs/promises";
import pg from "pg";
import { pgClientConfig, formatDatabaseError } from "../src/lib/server/pg-config.mjs";

const file = process.argv[2];
if (!file) {
  console.error("usage: verify-migration.mjs <path-to.sql>");
  process.exit(2);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set.");
  process.exit(2);
}

const sql = await readFile(file, "utf8");
const client = new pg.Client(pgClientConfig(process.env.DATABASE_URL));

try {
  await client.connect();
} catch (error) {
  console.error(formatDatabaseError(error, process.env.DATABASE_URL));
  process.exit(1);
}

let failed = false;
try {
  await client.query("begin");
  await client.query(sql);

  // Report what the migration would have created, from inside the transaction.
  //
  // The tables are read out of the migration text rather than hardcoded, so
  // this stays useful for the next migration instead of describing the last one.
  const touched = [
    ...sql.matchAll(/(?:create table(?: if not exists)?|alter table(?: only)?)\s+([a-z_][a-z0-9_]*)/gi),
  ].map((m) => m[1].toLowerCase());
  const tableNames = [...new Set(touched)];

  const tables = await client.query(
    `select table_name from information_schema.tables
      where table_schema = 'public' and table_name = any($1::text[])
      order by table_name`,
    [tableNames],
  );
  const columns = await client.query(
    `select table_name, column_name, data_type from information_schema.columns
      where table_schema = 'public' and table_name = any($1::text[])
      order by table_name, ordinal_position`,
    [tableNames],
  );
  const indexes = await client.query(
    `select tablename, indexname from pg_indexes
      where schemaname = 'public' and tablename = any($1::text[])
      order by tablename, indexname`,
    [tableNames],
  );

  console.log("tables touched:", tableNames.join(", ") || "(none)");
  console.log(
    "tables present after:",
    tables.rows.map((r) => r.table_name).join(", ") || "(none)",
  );
  for (const name of tables.rows.map((r) => r.table_name)) {
    const cols = columns.rows.filter((r) => r.table_name === name);
    console.log(`  ${name}: ${cols.map((c) => c.column_name).join(", ")}`);
    const idx = indexes.rows.filter((r) => r.tablename === name).map((r) => r.indexname);
    if (idx.length) console.log(`    indexes: ${idx.join(", ")}`);
  }
  console.log("\nMigration applied cleanly.");
} catch (error) {
  failed = true;
  console.error("Migration FAILED:", error.message);
} finally {
  await client.query("rollback").catch(() => {});
  await client.end().catch(() => {});
  console.log("Rolled back — the database is untouched.");
}

process.exit(failed ? 1 : 0);
