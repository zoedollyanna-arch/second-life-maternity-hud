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

const SHIPPED_LSL_SECRET = "2175039403870ed15116d0dcf330095af3f6a398e83bca01";
const PRODUCTION_APP_URL = "https://second-life-maternity-hud-t2b3.onrender.com";

export function apiSecret(): string {
  const secret = process.env.SL_API_SECRET?.trim();
  // Never throw: a missing env var used to 500 every HUD register/poll and
  // Second Life then throttles the object ("Too many erroneous (5XX)…").
  if (secret) return secret;
  return SHIPPED_LSL_SECRET;
}

function stripSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function isLocalHost(value: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(value);
}

/** Public origin the in-world media browser can actually load. */
export function appUrl(request?: Request): string {
  const configured = process.env.APP_URL?.trim();
  if (configured) {
    const url = stripSlash(configured);
    if (!isLocalHost(url)) return url;
  }
  const render = process.env.RENDER_EXTERNAL_URL?.trim();
  if (render) return stripSlash(render);
  if (request) {
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    const proto = request.headers.get("x-forwarded-proto") ?? "https";
    if (host) return stripSlash(`${proto}://${host}`);
  }
  return PRODUCTION_APP_URL;
}
