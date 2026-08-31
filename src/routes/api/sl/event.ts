import { createFileRoute } from "@tanstack/react-router";
import { json, readJson, sessionFromRequest, runSlHandler } from "@/lib/server/http";
import { performAction } from "@/lib/server/game";

const ALLOWED_EVENTS = new Set(["kick", "belly_touch", "bathroom"]);

export const Route = createFileRoute("/api/sl/event")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        runSlHandler(async () => {
          const body = await readJson(request);
          const user = await sessionFromRequest(request, body);
          if (!user) return json({ error: "unauthorized" }, 401);

          const type = typeof body.type === "string" ? body.type : "";
          if (!ALLOWED_EVENTS.has(type)) return json({ error: "unknown event" }, 400);

          const result = await performAction(user, type, body, "sl");
          return json(result, result.ok ? 200 : 400);
        }),
    },
  },
});
