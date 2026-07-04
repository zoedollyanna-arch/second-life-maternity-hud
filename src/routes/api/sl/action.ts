import { createFileRoute } from "@tanstack/react-router";
import { json, readJson, sessionFromRequest } from "@/lib/server/http";
import { performAction } from "@/lib/server/game";

// Actions the in-world scripts (mainly the partner HUD) may trigger.
const SL_ACTIONS = new Set([
  "hug",
  "support",
  "partner_message",
  "partner_water",
  "partner_backrub",
  "partner_appointment",
  "partner_status",
  "drink_water",
  "eat",
  "food_eat",
  "rest",
  "vitamins",
  "medicine",
  "bathroom",
  "doctor",
  "kick",
  "heartbeat",
  "hold_belly",
  "talk_to_baby",
  "craving_choice",
  "random_event_choice",
  "comfort_complete",
]);

export const Route = createFileRoute("/api/sl/action")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await readJson(request);
        const user = await sessionFromRequest(request, body);
        if (!user) return json({ error: "unauthorized" }, 401);

        const action = typeof body.action === "string" ? body.action : "";
        if (!SL_ACTIONS.has(action)) return json({ error: "unknown action" }, 400);

        const result = await performAction(user, action, body, "sl");
        return json(result, result.ok ? 200 : 400);
      },
    },
  },
});
