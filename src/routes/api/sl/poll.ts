import { createFileRoute } from "@tanstack/react-router";
import { json, sessionFromRequest } from "@/lib/server/http";
import { db } from "@/lib/server/db";
import { pregnancyForUser, takePendingCommands } from "@/lib/server/game";
import { computeProgress } from "@/lib/pregnancy";

export const Route = createFileRoute("/api/sl/poll")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await sessionFromRequest(request);
        if (!user) return json({ error: "unauthorized" }, 401);

        const url = new URL(request.url);
        const kindParam = url.searchParams.get("kind");
        const kind = kindParam === "belly" || kindParam === "partner" ? kindParam : "hud";

        await db().query(
          `update sl_devices set last_seen = now() where user_id = $1 and kind = $2`,
          [user.id, kind],
        );

        const preg = await pregnancyForUser(user);
        const week = preg
          ? computeProgress(new Date(preg.conceived_at), preg.duration_days).week
          : 0;
        const commands = await takePendingCommands(user.id, kind);
        return json({ week, commands });
      },
    },
  },
});
