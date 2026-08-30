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
  "sleep",
  "vomit",
  "cry",
  "feel_kick",
  "count_kick",
  "water_break",
  "contractions",
  "go_to_hospital",
  "birth",
  "pack_bag",
  "pack_bag_complete",
  "partner_comfort",
  "partner_check_on",
  "partner_ice_chips",
  "partner_help_rest",
  "partner_medicine",
  "partner_labor_support",
  "partner_breathing",
  "partner_celebrate",
  "partner_pack_bag",
  "partner_faint",
  "partner_vomit_react",
  "partner_stay_strong",
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
