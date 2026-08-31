// Applies db/migrations/*.sql in order, tracking applied files in
// public.schema_migrations. Missing or unreachable DATABASE_URL skips
// cleanly so the web process can still boot.
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";
import { formatDatabaseError, pgClientConfig } from "../src/lib/server/pg-config.mjs";

const migrationsDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "db",
  "migrations",
);

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.log("DATABASE_URL is not set — skipping migrations.");
  process.exit(0);
}

const client = new pg.Client(pgClientConfig(databaseUrl));
try {
  await client.connect();
} catch (error) {
  console.error(formatDatabaseError(error, databaseUrl));
  console.log("Skipping migrations; starting the web server anyway.");
  process.exit(0);
}

try {
  await client.query(`
    create table if not exists schema_migrations (
      filename text primary key,
      applied_at timestamptz not null default now()
    )`);

  const applied = new Set(
    (await client.query("select filename from schema_migrations")).rows.map((r) => r.filename),
  );

  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith(".sql")).sort();

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`skip    ${file}`);
      continue;
    }
    const sql = await readFile(path.join(migrationsDir, file), "utf8");
    console.log(`apply   ${file}`);
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query("insert into schema_migrations (filename) values ($1)", [file]);
      await client.query("commit");
    } catch (err) {
      await client.query("rollback");
      throw err;
    }
  }
  console.log("migrations complete");
} catch (error) {
  console.error(error);
  console.log("Skipping remaining migrations; starting the web server anyway.");
} finally {
  await client.end().catch(() => {});
}
