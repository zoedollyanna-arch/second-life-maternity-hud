import { createFileRoute } from "@tanstack/react-router";
import { json, sessionFromRequest } from "@/lib/server/http";
import { getDashboardState } from "@/lib/server/game";

export const Route = createFileRoute("/api/hud/state")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await sessionFromRequest(request);
        if (!user) return json({ error: "unauthorized" }, 401);
        const state = await getDashboardState(user);
        return json(state);
      },
    },
  },
});
