import { createFileRoute } from "@tanstack/react-router";
import { randomUUID } from "node:crypto";
import { json } from "@/lib/server/http";
import { db } from "@/lib/server/db";
import { getOrCreateUser, ensureActivePregnancy, createSession } from "@/lib/server/game";

// Creates a throwaway demo session so the dashboard can be previewed in a
// browser without wearing the HUD in Second Life.
// Disable in production with DISABLE_DEMO=1.
export const Route = createFileRoute("/api/hud/demo")({
  server: {
    handlers: {
      POST: async () => {
        if (process.env.DISABLE_DEMO === "1")
          return json({ error: "Demo mode is disabled on this server." }, 403);

        const user = await getOrCreateUser(randomUUID(), "Demo Resident", "mom");
        const preg = await ensureActivePregnancy(user.id);
        // Drop the demo mid-pregnancy so the dashboard has something to show,
        // and skip the first-attach wizard
        await db().query(
          `update pregnancies
           set conceived_at = now() - (duration_days * interval '1 day') * 0.6,
               setup_complete = true
           where id = $1`,
          [preg.id],
        );
        const token = await createSession(user.id);
        return json({ token });
      },
    },
  },
});
