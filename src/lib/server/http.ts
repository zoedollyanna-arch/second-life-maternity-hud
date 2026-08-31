import { apiSecret } from "./db";
import { resolveSession, type HudUser } from "./game";

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, max-age=0",
      pragma: "no-cache",
      "x-content-type-options": "nosniff",
    },
  });
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const declaredLength = Number(request.headers.get("content-length") ?? 0);
    if (Number.isFinite(declaredLength) && declaredLength > 65_536) return {};
    const raw = await request.text();
    if (raw.length > 65_536) return {};
    const body = JSON.parse(raw) as unknown;
    return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Second Life attaches identity headers to every llHTTPRequest. */
export function slIdentity(request: Request): { avatarKey: string; avatarName: string } | null {
  const avatarKey = request.headers.get("x-secondlife-owner-key");
  const avatarName = request.headers.get("x-secondlife-owner-name");
  if (!avatarKey || !avatarName || !/^[0-9a-f-]{36}$/i.test(avatarKey)) return null;
  return { avatarKey, avatarName: avatarName.trim() };
}

export function checkSecret(body: Record<string, unknown>): boolean {
  const provided = typeof body.secret === "string" ? body.secret.trim() : "";
  let expected = "";
  try {
    expected = apiSecret().trim();
  } catch {
    return false;
  }
  if (!provided || !expected || provided.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

/**
 * Second Life blocks an object after five HTTP 5xx replies in a short window
 * ("Too many erroneous (5XX) HTTP responses too fast"). SL-facing handlers
 * must never leak those — return 429 JSON instead and let the script back off.
 */
export function slBusy(error?: unknown, retrySeconds = 90): Response {
  if (error) console.error(error);
  const raw = error instanceof Error ? error.message : error ? String(error) : "";
  const message = /DATABASE_URL|Postgres|ECONN|ssl|password|tenant|not found/i.test(raw)
    ? "Database is not reachable yet. The HUD will retry."
    : "Server is busy. The HUD will retry.";
  return json({ ok: false, error: message, retry_seconds: retrySeconds }, 429);
}

export async function runSlHandler(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (error) {
    return slBusy(error);
  }
}

export function isSlApiRequest(request: Request): boolean {
  try {
    return new URL(request.url).pathname.startsWith("/api/sl/");
  } catch {
    return false;
  }
}

/** Prevent the push worker from becoming an arbitrary server-side HTTP client. */
export function slCallbackUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  try {
    const url = new URL(value);
    // Linden warns that HTTP-in domains can change, so validate the stable
    // capability shape and official HTTP-in ports rather than a host suffix.
    const isHttpIn =
      (url.protocol === "http:" && url.port === "12046") ||
      (url.protocol === "https:" && url.port === "12043");
    if (!isHttpIn) return null;
    if (!url.pathname.startsWith("/cap/")) return null;
    url.username = "";
    url.password = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

export async function sessionFromRequest(
  request: Request,
  body?: Record<string, unknown>,
): Promise<HudUser | null> {
  const url = new URL(request.url);
  const token =
    (typeof body?.token === "string" ? body.token : null) ??
    url.searchParams.get("token") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    null;
  return resolveSession(token);
}
