import pg from "pg";
import { formatDatabaseError, pgPoolConfig } from "./pg-config.mjs";

let pool: pg.Pool | undefined;

export function db(): pg.Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is not set");
    try {
      pool = new pg.Pool(pgPoolConfig(connectionString));
    } catch (error) {
      throw new Error(formatDatabaseError(error, connectionString));
    }
    pool.on("error", (error) => {
      console.error(formatDatabaseError(error, connectionString));
    });
  }
  return pool;
}

export function apiSecret(): string {
  const secret = process.env.SL_API_SECRET;
  if (!secret) throw new Error("SL_API_SECRET is not set");
  return secret;
}

export function appUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}
