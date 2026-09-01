import { createFileRoute } from "@tanstack/react-router";
import {
  json,
  readJson,
  slIdentity,
  checkSecret,
  slCallbackUrl,
  runSlHandler,
} from "@/lib/server/http";
import { appUrl, db } from "@/lib/server/db";
import { getOrCreateUser, upsertDevice, createSession } from "@/lib/server/game";
import { requestLink } from "@/lib/server/partner";

export const Route = createFileRoute("/api/sl/partner-link")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        runSlHandler(async () => {
          const body = await readJson(request);
          if (!checkSecret(body))
            return json({ error: "Bad secret — update API_SECRET in the LSL script." }, 403);

          const identity = slIdentity(request);
          if (!identity) return json({ error: "Second Life objects only." }, 403);

          const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
          if (!/^[A-Z0-9]{6}$/.test(code))
            return json({ error: "That code doesn't look right — it's 6 letters/numbers." }, 400);

          const { rows } = await db().query(
            `select p.id, p.user_id, u.avatar_key as mom_key, u.avatar_name as mom_name
             from pregnancies p join hud_users u on u.id = p.user_id
             where p.partner_code = $1 and p.status = 'active' limit 1`,
            [code],
          );
          const preg = rows[0];
          if (!preg) return json({ error: "No active pregnancy found for that code." }, 404);
          if (preg.mom_key === identity.avatarKey)
            return json(
              { error: "That's your own pregnancy code — give it to your partner ♥" },
              400,
            );

          const partner = await getOrCreateUser(
            identity.avatarKey,
            identity.avatarName,
            "partner",
          );

          // The code alone no longer grants access: it creates a request she
          // approves. Someone she has linked before reconnects immediately.
          let link: { status: "pending" | "active" };
          try {
            link = await requestLink({
              pregnancyId: preg.id,
              momId: preg.user_id,
              partnerUserId: partner.id,
              partnerName: identity.avatarName,
              momName: preg.mom_name,
            });
          } catch (error) {
            return json({ error: (error as Error).message }, 409);
          }

          const objectKey = typeof body.object_key === "string" ? body.object_key : preg.id;
          await upsertDevice(
            partner.id,
            "partner",
            objectKey,
            slCallbackUrl(body.callback_url),
            typeof body.region === "string" ? body.region : null,
          );

          // The screen loads either way — pending simply shows the waiting state,
          // so they can watch for her answer instead of re-touching the HUD.
          const token = await createSession(partner.id);
          const moapUrl = `${appUrl(request)}/partner?token=${token}`;

          return json({
            token,
            status: link.status,
            mom_name: preg.mom_name,
            mom_key: preg.mom_key,
            moap_url: moapUrl,
            message:
              link.status === "active"
                ? `Paired with ${preg.mom_name} ♥ The Partner HUD screen is now live.`
                : `Request sent to ${preg.mom_name}. Your screen will unlock when she accepts.`,
          });
        }),
    },
  },
});
