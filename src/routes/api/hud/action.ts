import { createFileRoute } from "@tanstack/react-router";
import { json, readJson, sessionFromRequest } from "@/lib/server/http";
import { performAction } from "@/lib/server/game";

// Actions the web dashboard buttons may trigger.
const WEB_ACTIONS = new Set([
  "drink_water",
  "eat",
  "food_eat",
  "rest",
  "vitamins",
  "bathroom",
  "comfort",
  "hug",
  "support",
  "doctor",
  "kick",
  "memory",
  "journal_add",
  "event",
  "symptom_log",
  "settings_update",
  "notifications_read",
  "daily_checkin",
  "hold_belly",
  "ultrasound",
  "appointment",
  "baby_size",
  "heartbeat",
  "talk_to_baby",
  "baby_position",
  "breathe",
  "warm_bath",
  "snack",
  "craving_roll",
  "craving_choice",
  "craving_set",
  "random_event_roll",
  "random_event_choice",
  "setup_update",
  "update_week",
  "set_due_date",
  "ask_partner",
  "comfort_complete",
  "ultrasound_seen",
]);

export const Route = createFileRoute("/api/hud/action")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await readJson(request);
        const user = await sessionFromRequest(request, body);
        if (!user) return json({ error: "unauthorized" }, 401);

        const action = typeof body.action === "string" ? body.action : "";
        if (!WEB_ACTIONS.has(action)) return json({ error: "unknown action" }, 400);

        const params =
          typeof body.params === "object" && body.params !== null
            ? (body.params as Record<string, unknown>)
            : {};
        const result = await performAction(user, action, params, "web");
        return json(result, result.ok ? 200 : 400);
      },
    },
  },
});
