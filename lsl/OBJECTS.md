# In-world objects & assets shopping list

Everything you need to buy or build **full perm** (copy/modify/transfer as
needed for your product) to package Nestoria.

**Sounds are optional everywhere**: the MOAP dashboard synthesizes and plays
all system sounds (chimes, water, heartbeat, kicks, munching…) through the
media screen itself, and that audio is heard in Second Life. In-world sound
clips only add redundancy for people with media muted. Missing sounds and
animations are always skipped gracefully by the scripts.

## 1. Main HUD (required)

| Item | Notes |
| --- | --- |
| Tablet/screen mesh or prim | A flat panel worn as a HUD (Center or Top attachment). **Face 4** is the media screen (`MOAP_FACE = 4` in `nestoria_main_hud.lsl` — a plain box prim's front face; verify with Develop → Show Info → Show Face Info). Keep the screen face close to 4:3 — the dashboard renders at 1024×768. A decorative frame can be added around it later without touching the script. |
| `nestoria_main_hud.lsl` | Included in this folder — goes in the root prim. |
| **Comfort chair object** (`nestoria_chair`) | REQUIRED for the Comfort action. Any chair/armchair prim or mesh with `nestoria_comfort_chair.lsl` inside, taken to inventory named exactly `nestoria_chair`, then dropped into the Main HUD's contents. The HUD rezzes it when Comfort is pressed; the wearer sits 2 minutes for the comfort boost, then it cleans itself up. |
| Logo texture | Optional, for the HUD frame/back. Export `src/assets/nestoria-logo.png`. |

Animations (full perm, dropped into the HUD, named exactly):
- `nestoria_belly_hold` — soft belly-holding / belly-rub animation (you have this one)
- `nestoria_drink` — drink animation (optional)
- `nestoria_rest` — relax/stretch or sit-idle animation (optional)
- `nestoria_vitamins` — take-a-pill / hand-to-mouth animation (optional)

Sounds (optional — the MOAP screen already plays these):
- `nestoria_chime`, `nestoria_heartbeat`, `nestoria_sip`

## 2. Belly sensor (recommended)

| Item | Notes |
| --- | --- |
| Small plain prim worn on the stomach | The script makes it **fully invisible** automatically — it sits inside whatever belly the wearer uses for the look (Reborn, BORK, or any other mesh belly add-on, or none). It only handles kicks, heartbeat moments and bump touches; it does not grow or change shape, so it never fights with the wearer's body/belly choice. |
| `nestoria_belly.lsl` | Included — goes in the prim. |

Sounds (optional): `nestoria_kick`, `nestoria_heartbeat`

## 3. Comfort chair (required for the Comfort action)

| Item | Notes |
| --- | --- |
| Chair/armchair mesh or prim | Anything sit-able and cozy-looking. Adjust `SIT_TARGET`/`SIT_ROT` in the script to fit the mesh. |
| `nestoria_comfort_chair.lsl` | Included — goes inside the chair. Then put the whole chair (named `nestoria_chair`) inside the Main HUD. |

## 4. Partner HUD (recommended)

| Item | Notes |
| --- | --- |
| Small button/badge mesh or prim | Worn as a HUD by the partner; all interaction is via touch menus, no media face needed. A heart-shaped prim works great. |
| `nestoria_partner_hud.lsl` | Included — goes in the root prim. |

Optional: `nestoria_chime` sound, couple hug animation (extend the script's
`Hug` branch with `llRequestPermissions` + `llStartAnimation` if you add one).

## 5. Nice-to-have extras (not scripted yet)

- Particle textures: heart + sparkle (the scripts currently use default
  particle dots tinted pink/lavender; a custom heart texture upgrade is a
  one-line change in `heartsBurst()`)
- Food props for the integrated foods — ham sub, spaghetti, chicken bacon
  burger, lasagna, jam toast, cheeseburger, french toast, pickle chips,
  chocolate bar. The foods already work as MOAP nutrition/craving items;
  props are cosmetic hand-helds only.
- Water bottle / vitamin bottle props, doctor clipboard, stethoscope,
  ultrasound photo texture
- Boxed product: box mesh, landmark, notecard with the setup steps from
  `README.md`

(Baby shower / gender reveal etc. are handled as journal & event entries on
the dashboard — no props needed.)

## MOAP HUD inventory checklist

The MOAP screen is the main hub. The HUD frame touch only refreshes/syncs the
screen; Second Life `llDialog` popups are reserved for server-pushed random
events and cravings.

Put these inside the main HUD root prim:

- `nestoria_main_hud.lsl`
- `nestoria_chair` object (chair with `nestoria_comfort_chair.lsl` inside)
- `nestoria_belly_hold` animation
- optional: `nestoria_drink` / `nestoria_rest` / `nestoria_vitamins` animations
- optional: `nestoria_chime` / `nestoria_heartbeat` / `nestoria_sip` sounds
- optional: frame/logo texture, heart/sparkle particle textures

## Where to get full-perm assets

Marketplace categories: "full perm animations" (drink/rest/couple), "full perm
mesh HUD base", "full perm mesh chair". Always confirm the license allows use
in a scripted product before packaging.

## Checklist before selling

1. Set `API_BASE` + `API_SECRET` in all four scripts (must match your `.env`).
2. Set scripts to **no-mod** in the boxed product if you don't want your
   secret readable — or move buyers to their own server + secret.
3. HUD prim: script + chair + anims inside, worn once to test the media screen
   loads and plays sound (wearer needs media enabled).
4. Belly prim: worn inside the mesh belly of choice; confirm it goes invisible
   and kicks arrive.
5. Comfort: press Comfort on the dashboard, sit the full 2 minutes, confirm
   the +25 comfort lands.
6. Test the partner pairing flow with a second avatar.
