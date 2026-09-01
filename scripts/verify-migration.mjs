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
  const tables = await client.query(
    `select table_name from information_schema.tables
      where table_schema = 'public'
        and table_name = any($1::text[])
      order by table_name`,
    [
      [
        "pregnancy_partner_links",
        "pregnancy_events",
        "pregnancy_interaction_requests",
        "hospital_bag_items",
        "pregnancy_milestones",
      ],
    ],
  );
  const columns = await client.query(
    `select table_name, column_name from information_schema.columns
      where table_schema = 'public'
        and ((table_name = 'pregnancies' and column_name in
               ('labor_onset_frac','labor_plan','labor_phase','labor_engine_at'))
          or (table_name = 'notifications' and column_name in
               ('pregnancy_id','sender_id','severity','event_type','event_id','metadata')))
      order by table_name, column_name`,
  );
  const backfilled = await client.query(
    `select count(*)::int as n from pregnancy_partner_links where status = 'active'`,
  );

  console.log("tables present:", tables.rows.map((r) => r.table_name).join(", "));
  console.log(
    "columns added:",
    columns.rows.map((r) => `${r.table_name}.${r.column_name}`).join(", "),
  );
  console.log("existing couples backfilled to active links:", backfilled.rows[0].n);
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
