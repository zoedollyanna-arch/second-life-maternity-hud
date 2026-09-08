import { createFileRoute } from "@tanstack/react-router";
import { json, readJson, sessionFromRequest } from "@/lib/server/http";
import { db } from "@/lib/server/db";
import { requestLink } from "@/lib/server/partner";

/**
 * Redeem a pairing code from the Partner HUD *screen*.
 *
 * /api/sl/partner-link already does this, but only for Second Life: it is
 * gated on the X-SecondLife-* identity headers, so the browser cannot call it,
 * and the only way in was the in-world blue text box. The client's feedback
 * was that there is no visible place to type the code — this is that place.
 *
 * It cannot go through /api/hud/action because performAction resolves a
 * pregnancy first and bails with "No active pregnancy linked to this HUD",
 * which is exactly the state an unpaired partner is in.
 */
export const Route = createFileRoute("/api/hud/pair")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await readJson(request);
        const user = await sessionFromRequest(request, body);
        if (!user) return json({ error: "unauthorized" }, 401);

        const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
        if (!/^[A-Z0-9]{6}$/.test(code)) {
          return json(
            { error: "That code is 6 letters or numbers — check it and try again." },
            400,
          );
        }

        const { rows } = await db().query(
          `select p.id, p.user_id, u.avatar_key as mom_key, u.avatar_name as mom_name
             from pregnancies p join hud_users u on u.id = p.user_id
            where p.partner_code = $1 and p.status = 'active' limit 1`,
          [code],
        );
        const preg = rows[0];
        if (!preg) return json({ error: "No pregnancy found for that code." }, 404);
        if (preg.user_id === user.id) {
          return json({ error: "That is your own code — give it to your partner." }, 400);
        }

        try {
          const link = await requestLink({
            pregnancyId: preg.id,
            momId: preg.user_id,
            partnerUserId: user.id,
            partnerName: user.display_name ?? user.avatar_name,
            momName: preg.mom_name,
          });
          return json({
            ok: true,
            status: link.status,
            momName: preg.mom_name,
            message:
              link.status === "active"
                ? `Paired with ${preg.mom_name}. Your screen is live.`
                : `Request sent to ${preg.mom_name}. This screen unlocks when she accepts.`,
          });
        } catch (error) {
          return json({ error: (error as Error).message }, 409);
        }
      },
    },
  },
});
