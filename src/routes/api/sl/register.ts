import { createFileRoute } from "@tanstack/react-router";
import { json, readJson, slIdentity, checkSecret, slCallbackUrl } from "@/lib/server/http";
import { registerDevice } from "@/lib/server/game";

export const Route = createFileRoute("/api/sl/register")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await readJson(request);
        if (!checkSecret(body))
          return json({ error: "Bad secret — update API_SECRET in the LSL script." }, 403);

        const identity = slIdentity(request);
        if (!identity)
          return json(
            { error: "This endpoint only accepts requests from Second Life objects." },
            403,
          );

        const kind = body.kind === "belly" || body.kind === "partner" ? body.kind : "hud";
        const objectKey = typeof body.object_key === "string" ? body.object_key : "";
        if (!/^[0-9a-f-]{36}$/i.test(objectKey)) return json({ error: "Missing object key." }, 400);

        const result = await registerDevice({
          avatarKey: identity.avatarKey,
          avatarName: identity.avatarName,
          kind,
          objectKey,
          callbackUrl: slCallbackUrl(body.callback_url),
          region: typeof body.region === "string" ? body.region : null,
        });
        return json(result);
      },
    },
  },
});
