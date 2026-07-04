import { createFileRoute } from "@tanstack/react-router";
import { json, readJson, slIdentity, checkSecret } from "@/lib/server/http";
import { db } from "@/lib/server/db";
import {
  getOrCreateUser,
  upsertDevice,
  createSession,
  addNotification,
  queueCommand,
} from "@/lib/server/game";

export const Route = createFileRoute("/api/sl/partner-link")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await readJson(request);
        if (!checkSecret(body))
          return json({ error: "Bad secret — update API_SECRET in the LSL script." }, 403);

        const identity = slIdentity(request);
        if (!identity) return json({ error: "Second Life objects only." }, 403);

        const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
        if (!/^[A-Z0-9]{6}$/.test(code))
          return json({ error: "That code doesn't look right — it's 6 letters/numbers." }, 400);

        const { rows } = await db().query(
          `select p.*, u.avatar_key as mom_key, u.avatar_name as mom_name
           from pregnancies p join hud_users u on u.id = p.user_id
           where p.partner_code = $1 and p.status = 'active' limit 1`,
          [code],
        );
        const preg = rows[0];
        if (!preg) return json({ error: "No active pregnancy found for that code." }, 404);
        if (preg.mom_key === identity.avatarKey)
          return json({ error: "That's your own pregnancy code — give it to your partner ♥" }, 400);

        const partner = await getOrCreateUser(identity.avatarKey, identity.avatarName, "partner");
        await db().query(
          `update pregnancies set partner_user_id = $2, partner_name = $3, updated_at = now()
           where id = $1`,
          [preg.id, partner.id, identity.avatarName],
        );

        const objectKey = typeof body.object_key === "string" ? body.object_key : preg.id;
        await upsertDevice(
          partner.id,
          "partner",
          objectKey,
          null,
          typeof body.region === "string" ? body.region : null,
        );
        const token = await createSession(partner.id);

        await addNotification(
          preg.user_id,
          "Partner linked ♥",
          `${identity.avatarName} is now supporting you on this journey.`,
        );
        await queueCommand(preg.user_id, "hud", "hearts", {});
        await queueCommand(preg.user_id, "hud", "say", {
          text: `${identity.avatarName} linked their Partner HUD to your pregnancy ♥`,
        });

        return json({
          token,
          mom_name: preg.mom_name,
          mom_key: preg.mom_key,
          message: `Paired with ${preg.mom_name} ♥ Touch the HUD any time to support her.`,
        });
      },
    },
  },
});
