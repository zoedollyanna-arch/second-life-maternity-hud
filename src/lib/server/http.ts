import { apiSecret } from "./db";
import { resolveSession, type HudUser } from "./game";

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = (await request.json()) as unknown;
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
  const expected = apiSecret().trim();
  if (provided.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
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
