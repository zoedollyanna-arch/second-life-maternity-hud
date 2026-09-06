# In-world objects & assets shopping list

Everything you need to buy or build **full perm** (copy/modify/transfer as
needed for your product) to package Nestoria.

**Sounds are optional everywhere**: the MOAP dashboard synthesizes and plays
all system sounds (chimes, water, heartbeat, kicks, munching…) through the
media screen itself, and that audio is heard in Second Life. In-world sound
clips only add redundancy for people with media muted. Missing sounds and
animations are always skipped gracefully by the scripts.

## 1. Main HUD (required)

| Item                                        | Notes                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tablet/screen mesh or prim                  | A flat panel worn as a HUD (Center or Top attachment). **Face 4** is the media screen (`MOAP_FACE = 4` in `nestoria_main_hud.lsl` — a plain box prim's front face; verify with Develop → Show Info → Show Face Info). Keep the screen face close to 4:3 — the dashboard renders at 1024×768. A decorative frame can be added around it later without touching the script. |
| `nestoria_main_hud.lsl`                     | Included in this folder — goes in the root prim.                                                                                                                                                                                                                                                                                                                          |
| **Comfort chair object** (`nestoria_chair`) | REQUIRED for the Comfort action. Any chair/armchair prim or mesh with `nestoria_comfort_chair.lsl` inside, taken to inventory named exactly `nestoria_chair`, then dropped into the Main HUD's contents. The HUD rezzes it when Comfort is pressed; the wearer sits 2 minutes for the comfort boost, then it cleans itself up.                                            |
| Logo texture                                | Optional, for the HUD frame/back. Export `src/assets/nestoria-logo.png`.                                                                                                                                                                                                                                                                                                  |

Animations (full perm, dropped into the HUD, named exactly):

- `nestoria_belly_hold` — soft belly-holding / belly-rub animation (you have this one)
- `nestoria_drink` — drink animation (optional)
- `nestoria_rest` — relax/stretch or sit-idle animation (optional)
- `nestoria_vitamins` — take-a-pill / hand-to-mouth animation (optional)

Sounds (optional — the MOAP screen already plays these):

- `nestoria_chime`, `nestoria_heartbeat`, `nestoria_sip`

## 2. Belly sensor (recommended)

| Item                                 | Notes                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Small plain prim worn on the stomach | The script makes it **fully invisible** automatically — it sits inside whatever belly the wearer uses for the look (Reborn, BORK, or any other mesh belly add-on, or none). It only handles kicks, heartbeat moments and bump touches; it does not grow or change shape, so it never fights with the wearer's body/belly choice. |
| `nestoria_belly.lsl`                 | Included — goes in the prim.                                                                                                                                                                                                                                                                                                     |

Sounds (optional): `nestoria_kick`, `nestoria_heartbeat`

## 3. Comfort chair (required for the Comfort action)

| Item                         | Notes                                                                                                    |
| ---------------------------- | -------------------------------------------------------------------------------------------------------- |
| Chair/armchair mesh or prim  | Anything sit-able and cozy-looking. Adjust `SIT_TARGET`/`SIT_ROT` in the script to fit the mesh.         |
| `nestoria_comfort_chair.lsl` | Included — goes inside the chair. Then put the whole chair (named `nestoria_chair`) inside the Main HUD. |

## 3b. Hospital bag (worn — do not rez from the HUD)

| Item                        | Notes                                                                                                                                 |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Simple prim for now         | Wearable box/prim is enough until the custom bag mesh is ready. Name it `nestoria_hospital_bag`. Drop `nestoria_hospital_bag.lsl` in it. She or partner wears it. Swap the prim for the mesh later — the script stays the same. |
| `nestoria_hospital_bag.lsl` | Hears `nestoria_bag_pack` on the same owner channel as the chair. Bag → Open the worn bag talks to it. Touch also packs. The 18-item checklist on the HUD is shared with the Partner HUD and is separate from this object — the two complement each other. |

## 3d. Toilet (physical bathroom)

| Item                  | Notes                                                                 |
| --------------------- | --------------------------------------------------------------------- |
| Toilet mesh           | Named `nestoria_toilet` if kept in the Main HUD. Can also be placed.  |
| `nestoria_toilet.lsl` | Bathroom on the HUD rezzes it if present, and talks to one already out. Sit or touch for the RP moment. |

## 3c. Hospital bed (physical labor / birth)

| Item                        | Notes                                                                                                                                      |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Hospital bed mesh           | Place in-world **or** put a copy named `nestoria_hospital_bed` in the Main HUD. Go to Hospital rezzes it if present, and always talks to any bed already out. |
| `nestoria_hospital_bed.lsl` | Sit for the scene. The **server** starts water break / contractions / birth when the pregnancy reaches term — nobody presses a button for it — and the HUD forwards `nestoria_labor_water` / `nestoria_labor_contractions` / `nestoria_labor_birth` to the bed. HUD-rezzed beds expire if unused. |

## 4. Partner HUD (recommended)

| Item                            | Notes                                                                                                                    |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Tablet/screen mesh or prim      | Worn as a HUD. **Face 4** loads `/partner?token=…`. Touch pairs or refreshes the screen. Support actions are on the page only. |
| `nestoria_partner_hud.lsl`      | Included — goes in the root prim.                                                                                        |

Pairing is now two-sided: entering her code sends her a request, and the
screen stays on "Not linked yet" until she accepts on her own HUD. It unlocks
by itself when she does — no need to touch the HUD again.

Optional animations (full perm, dropped into the Partner HUD, named exactly).
Missing ones are skipped silently:

- `nestoria_faint` — used by the optional birth reaction "Feel faint"
- `nestoria_vomit` — used by the optional birth reaction "Get queasy"

Both reactions are pure roleplay: the server ignores them when deciding
anything about her labor. They are off unless the wearer picks them under
More → My reactions, and `nestoria_chime` remains an optional sound.

## 5. Hand-held props — foods, water bottle, vitamins (recommended)

One universal script, `nestoria_prop.lsl`, powers every hand-held prop:
cute hovertext with a ♥♥♥♡♡ progress bar, sweet RP lines in local chat,
an eat/drink/hold animation, and automatic server credit through the Main
HUD when finished (props never need the API secret).

| Item                 | Prop description field                                          |
| -------------------- | --------------------------------------------------------------- |
| Ham sub              | `food_eat\|ham_sub\|eat\|35\|Ham Sub`                           |
| Spaghetti            | `food_eat\|spaghetti\|eat\|40\|Spaghetti`                       |
| Chicken bacon burger | `food_eat\|chicken_bacon_burger\|eat\|35\|Chicken Bacon Burger` |
| Lasagna              | `food_eat\|lasagna\|eat\|40\|Lasagna`                           |
| Jam toast            | `food_eat\|jam_toast\|eat\|20\|Jam Toast`                       |
| Cheeseburger         | `food_eat\|cheeseburger\|eat\|30\|Cheeseburger`                 |
| French toast         | `food_eat\|french_toast\|eat\|25\|French Toast`                 |
| Pickle chips         | `food_eat\|pickle_chips\|eat\|30\|Pickle Chips`                 |
| Chocolate bar        | `food_eat\|chocolate_bar\|eat\|25\|Chocolate Bar`               |
| Pizza                | `food_eat\|pizza\|eat\|35\|Pizza`                               |
| Pickles              | `food_eat\|pickles\|eat\|25\|Pickles`                           |
| Ice cream            | `food_eat\|ice_cream\|eat\|25\|Ice Cream`                       |
| Strawberries         | `food_eat\|strawberries\|eat\|20\|Strawberries`                 |
| Watermelon           | `food_eat\|watermelon\|eat\|20\|Watermelon`                     |
| Lemonade             | `food_eat\|lemonade\|drink\|20\|Lemonade`                       |
| Ginger ale           | `food_eat\|ginger_ale\|drink\|20\|Ginger Ale`                   |
| Ice chips            | `food_eat\|ice_chips\|drink\|15\|Ice Chips`                     |
| Corn starch          | `food_eat\|corn_starch\|eat\|20\|Corn Starch`                   |
| Chalk                | `food_eat\|chalk\|eat\|20\|Chalk`                               |
| Water bottle         | `drink_water\|\|drink\|20\|Water Bottle`                        |
| Vitamin bottle       | `vitamins\|\|hold\|12\|Prenatal Vitamins`                       |

Setup per prop: full-perm mesh food/bottle → drop in `nestoria_prop.lsl` →
paste the description line → (optional) add a full-perm animation named
`nestoria_eat`, `nestoria_drink` or `nestoria_hold`. Worn from inventory it
plays the whole scene and detaches itself when done.

## 6. Ultrasound scrapbook (no objects needed)

The 10 ultrasound photos ship inside the web app (`public/ultrasounds/`).
They unlock automatically at weeks 6, 9, 12, 16, 20, 24, 28, 32, 36 and 39 —
the wearer gets a toast + notification, and collected scans are browsable in
the polaroid-style scrapbook on the Baby panel. Nothing to build in-world.

## 7. Nice-to-have extras (not scripted yet)

- Particle textures: heart + sparkle (the scripts currently use default
  particle dots tinted pink/lavender; a custom heart texture upgrade is a
  one-line change in `heartsBurst()`)
- Doctor/checkup clipboard, stethoscope props
- Boxed product: box mesh, landmark, notecard with the setup steps from
  `README.md`

(Baby shower / gender reveal etc. are handled as journal & event entries on
the dashboard — no props needed.)

## 8. Animations & sounds — the full list

Every one of these is **optional**. The HUD checks whether the item is in its
contents before playing it, so nothing errors when a name is missing — the
action still changes the meters and still writes its roleplay line. Drop an
animation in with the matching name and it starts working immediately; no
script edit is needed.

Where a fallback is listed, that animation plays until the real one is added.

| Name | Plays when | Fallback | Priority |
| ---- | ---------- | -------- | -------- |
| `nestoria_rest` | Rest, and as the fallback for several others | — | **Do this first** |
| `nestoria_drink` | Drink water, ice chips | — | **Do this first** |
| `nestoria_vitamins` | Take vitamins | — | **Do this first** |
| `nestoria_belly_hold` | Hold belly, rub belly, feeling a kick | — | **Do this first** |
| `nestoria_sleep` | Sleep, nap | `nestoria_rest` | High |
| `nestoria_vomit` | Being sick | `nestoria_rest` | High |
| `nestoria_cry` | Crying, and emotional mood swings | none — silent today | High |
| `nestoria_yawn` | Sleepy and tired moods, "can't sleep" | `nestoria_rest` | Medium |
| `nestoria_bathroom` | Bathroom break | none — silent today | Medium |
| `nestoria_contraction` | Contractions during labor | `nestoria_rest` | Medium |
| `nestoria_comfort` | Comfort (alongside the chair) | none | Low |

Sounds follow the same rule — present means played, missing means skipped:

| Name | Plays when | Priority |
| ---- | ---------- | -------- |
| `nestoria_chime` | Notifications, hearts, vitamins | **Do this first** |
| `nestoria_heartbeat` | Doctor, ultrasound, contractions | **Do this first** |
| `nestoria_sip` | Drinking | High |
| `nestoria_vomit` | Being sick (falls back to the chime) | High |
| `nestoria_cry` | Crying | Medium |
| `nestoria_yawn` | Sleepy moods, going to sleep | Low |

> The dashboard also generates its own sounds through the media screen, so the
> HUD is never silent even with no sound files at all. These in-world clips are
> an upgrade, not a requirement.

### `nestoria_mess` — the vomiting aftermath

The feedback board draws vomiting as five beats: nausea → animation & sound →
particles → **food on the floor** → **clean up**. The first three are done. The
fourth needs a small rezzable object named `nestoria_mess` in the HUD's
contents — the HUD drops it on the floor in front of her when she is sick, and
skips that step silently when it is not there.

It needs a script of its own that removes it after a minute or two, the way
`nestoria_comfort_chair.lsl` cleans itself up. That script is not written yet.

## MOAP HUD inventory checklist

The MOAP screen is the main hub. The HUD frame touch only refreshes/syncs the
screen; Second Life `llDialog` popups are reserved for server-pushed random
events and cravings.

Put these inside the main HUD root prim:

Required:

- `nestoria_main_hud.lsl`
- `nestoria_chair` object (chair with `nestoria_comfort_chair.lsl` inside)

Optional objects, rezzed when present:

- `nestoria_hospital_bed`, `nestoria_toilet`, `nestoria_mess`

Optional animations and sounds — see section 8 for the full table:

- animations: `nestoria_rest`, `nestoria_drink`, `nestoria_vitamins`,
  `nestoria_belly_hold`, `nestoria_sleep`, `nestoria_vomit`, `nestoria_cry`,
  `nestoria_yawn`, `nestoria_bathroom`, `nestoria_contraction`,
  `nestoria_comfort`
- sounds: `nestoria_chime`, `nestoria_heartbeat`, `nestoria_sip`,
  `nestoria_vomit`, `nestoria_cry`, `nestoria_yawn`
- frame/logo texture, heart/sparkle particle textures

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
