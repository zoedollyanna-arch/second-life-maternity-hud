# Main HUD script upgrade

The Main HUD now uses three scripts in the **same root prim**. Compile each
with **Mono** selected in the Second Life script editor.

| Script | Responsibility | Settings |
| --- | --- | --- |
| `nestoria_main_hud.lsl` | Registration, push, polling, authenticated actions, and prop completion acknowledgments | `API_BASE`, `API_SECRET`, `POLL_SECONDS` |
| `nestoria_hud_media.lsl` | Media screen, attach/teleport recovery, frame touch, minimize/restore | `MOAP_LINK`, `MOAP_FACE`, `SCREEN_WIDTH`, `SCREEN_HEIGHT`, `SCREEN_AUTO_SCALE`, `MEDIA_WATCH_SECONDS` |
| `nestoria_hud_effects.lsl` | Event dialogs, animations, sounds, particles, inventory offers, and object rezzing | `VOLUME` |

Stack/heap collisions indicate exhausted script memory. Separating these
responsibilities gives each script its own memory budget. Main dispatches one
command's parameters per link message, releases each HTTP batch after dispatch,
and never sends a full HTTP response to either helper. Media recovery has its
own timer so HTTP backoff cannot postpone screen retries.
Second Life documents cooperating scripts and the memory limits of their
messages in the [link-message reference](https://wiki.secondlife.com/wiki/LlMessageLinked).

## Install or upgrade

1. Restore the old HUD to full size before changing scripts. Resetting a
   minimized media script loses its saved child positions; restore it first.
2. Replace the old main script with the updated `nestoria_main_hud.lsl`.
   Keep your deployment's API URL and shared secret.
3. Add `nestoria_hud_media.lsl` and `nestoria_hud_effects.lsl` to the **same
   root prim**, using those script names (with or without `.lsl`). Keep the
   existing animations, sounds, and prop objects in that root prim too.
4. Copy any custom screen link, face, and resolution into the media helper.
   The supplied defaults are link 2, face 4, and 800 × 450 pixels, with
   **Auto Scale Media on Face of Object checked** (`SCREEN_AUTO_SCALE = TRUE`).
5. Save all three scripts with Mono enabled and Running checked. Reset main
   last, then detach and reattach the HUD. Accept animation permissions if asked.
   Media also requests its current URL when it starts, so it can recover after
   being saved independently.

Keep only one copy of each script running. Do not leave the old combined main
script running alongside the updated scripts.

## Auto Scale and reattachment recovery

The earlier script explicitly wrote `PRIM_MEDIA_AUTO_SCALE = FALSE`; its
reattach retries therefore undid a manually checked box. It also cleared the
media entry, changed the navigation fragment, and replaced the screen texture
on each retry. The new helper requests Auto Scale enabled and updates media
parameters in place. The [Second Life media API](https://wiki.secondlife.com/wiki/LlSetLinkMedia)
overwrites supplied fields while preserving unspecified ones; clearing the
entry is unnecessary for changing Auto Scale.

The helper checks the actual media flag, width, height, autoplay, and home URL,
as well as the screen's texture repeats, offsets, rotation, tint, alpha,
fullbright, and glow. It restores full-face mapping for Auto Scale and retains
the underlying inventory texture. A minimized screen keeps its hidden alpha.

After attach, teleport, restore, or a media URL update, it checks several times
over approximately the first ten seconds. It then checks every 15 seconds,
repairing changes that appear later. Healthy checks make no media or texture
writes. Size or mapping repairs leave the current browser URL untouched;
navigation occurs for a changed URL, missing media, or an explicit refresh.
Refresh generates one navigation fragment that stays fixed across retries.
The helper preserves its URL and recovery state across `on_rez` on reattachment.

Select **link 2, face 4** (or your configured screen face) when inspecting Media
Settings. Leave Auto Scale checked. If it is unchecked later, the watchdog
corrects it at its next check. A missing screen link or face produces an owner
message instead of silently applying media to the root or a different face.
Another running copy of the old main or media script can still write conflicting
settings; replace the existing media helper and keep one copy running.

## Verification

Run these locally:

```text
python scripts/check-lsl.py
node --test scripts/test-hud-media.mjs
```

The first checks structure, reserved names, function dependencies, and globals.
The second runs the actual helper's media recovery functions against simulated
prim/media APIs, covering reattachment, late settings changes, stable URLs,
failed writes, missing media, invalid faces, refreshes, and minimized alpha.
The simulation uses a limited syntax adapter, not an LSL compiler. Neither
check measures runtime memory or viewer rendering; verify those in Second Life.

In-world checks:

- Start all three scripts; confirm the dashboard loads and updates via polling
  and push. Check that script contents show no runtime errors.
- Detach/reattach and teleport. Confirm the screen recovers after the delayed
  media checks. On the configured face, confirm **Auto Scale remains checked**
  and the dimensions remain **800 × 450** (or your configured size). Recheck
  after 20 seconds and repeat several times.
- With the dashboard on another tab or scrolled, temporarily uncheck Auto Scale
  or change the media size. Within the next watchdog interval it should restore
  the settings without navigating away from the tab or changing scroll position.
- Recompile only the media helper while main is unavailable. Its saved media
  URL should remain usable for repairing settings without a fresh registration.
- Touch the frame to minimize, then touch the tab to restore. Confirm child
  prims return to their original positions and the dashboard is interactive.
  Repeat after detaching and reattaching while minimized.
- Request an RP moment and answer its blue dialog. Confirm the corresponding
  HUD card closes. Test Close and a craving choice too.
- Trigger drink/rest and stop-animation commands with the matching inventory
  animations. Confirm detach stops the active animation. A command received
  before animation permission is granted should play after permission arrives.
- Use Comfort, a worn prop, and the hospital bag. Confirm the chair still rezzes,
  prop completion gets acknowledged once, and bag completion reaches the server.
- Exercise labor, hearts, and nausea effects. Confirm sounds, particles, and
  world-object messages still work when their optional assets are present.
- Monitor each script's memory with the viewer's script information tools while
  receiving several commands. Record the script name if any collision remains.

## Link-message protocol

Messages use `LINK_THIS`; all three scripts must share one prim. Receivers check
the sending link number. The `id` field carries a command/action name as a string
cast to `key`; it is not an avatar UUID. Scripts ignore messages for other roles.

| Number | Sender → receiver | String payload | `id` |
| --- | --- | --- | --- |
| 7100 | Main → helpers | One command's JSON parameters | Command name |
| 7101 | Effects → main | Action JSON parameters | Action name |
| 7102 | Main → media | Current dashboard URL | Null key |
| 7103 | Media → main | Empty | Null key; request registration |
| 7104 | Media → main | Empty | Null key; request current media URL |

The backend endpoints and command names are unchanged. A server redeploy is not
needed to install this script split.
