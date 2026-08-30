import { createFileRoute } from "@tanstack/react-router";
import { json, sessionFromRequest } from "@/lib/server/http";
import { loadJournalPhoto, saveJournalPhoto } from "@/lib/server/game";

const MAX_JSON_CHARS = 1_400_000;

function decodeBase64(raw: string): Buffer | null {
  const cleaned = raw.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "").replace(/\s+/g, "");
  if (!cleaned || cleaned.length > MAX_JSON_CHARS) return null;
  try {
    const bytes = Buffer.from(cleaned, "base64");
    return bytes.length ? bytes : null;
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/api/hud/photo")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await sessionFromRequest(request);
        if (!user) return json({ error: "unauthorized" }, 401);
        const id = new URL(request.url).searchParams.get("id") ?? "";
        const photo = await loadJournalPhoto(user, id);
        if (!photo) return json({ error: "not found" }, 404);
        return new Response(new Uint8Array(photo.bytes), {
          status: 200,
          headers: {
            "content-type": photo.mime,
            "cache-control": "private, max-age=86400",
            "x-content-type-options": "nosniff",
          },
        });
      },
      POST: async ({ request }) => {
        const raw = await request.text();
        if (raw.length > MAX_JSON_CHARS) return json({ error: "Photo is too large." }, 413);
        let body: Record<string, unknown> = {};
        try {
          const parsed = JSON.parse(raw) as unknown;
          if (parsed && typeof parsed === "object") body = parsed as Record<string, unknown>;
        } catch {
          return json({ error: "Invalid upload." }, 400);
        }
        const user = await sessionFromRequest(request, body);
        if (!user) return json({ error: "unauthorized" }, 401);
        const mime = typeof body.mime === "string" ? body.mime : "image/jpeg";
        const data = typeof body.data === "string" ? body.data : "";
        const bytes = decodeBase64(data);
        if (!bytes) return json({ error: "Could not read that photo." }, 400);
        try {
          const id = await saveJournalPhoto(user.id, mime, bytes);
          return json({ ok: true, id, url: `/api/hud/photo?id=${id}` });
        } catch (error) {
          return json(
            { error: error instanceof Error ? error.message : "Upload failed." },
            400,
          );
        }
      },
    },
  },
});
