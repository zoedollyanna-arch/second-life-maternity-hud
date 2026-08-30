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
| `nestoria_hospital_bag.lsl` | Hears `nestoria_bag_pack` on the same owner channel as the chair. Care → Pack hospital bag talks to it. Touch also packs.             |

## 3d. Toilet (physical bathroom)

| Item                  | Notes                                                                 |
| --------------------- | --------------------------------------------------------------------- |
| Toilet mesh           | Named `nestoria_toilet` if kept in the Main HUD. Can also be placed.  |
| `nestoria_toilet.lsl` | Bathroom on the HUD rezzes it if present, and talks to one already out. Sit or touch for the RP moment. |

## 3c. Hospital bed (physical labor / birth)

| Item                        | Notes                                                                                                                                      |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Hospital bed mesh           | Place in-world **or** put a copy named `nestoria_hospital_bed` in the Main HUD. Go to Hospital rezzes it if present, and always talks to any bed already out. |
| `nestoria_hospital_bed.lsl` | Sit for the scene. HUD starts water break / contractions / birth; the bed does the in-world RP. HUD-rezzed beds expire if unused.         |

## 4. Partner HUD (recommended)

| Item                            | Notes                                                                                                                    |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Tablet/screen mesh or prim      | Worn as a HUD. **Face 4** loads `/partner?token=…`. Touch pairs or refreshes the screen. Support actions are on the page only. |
| `nestoria_partner_hud.lsl`      | Included — goes in the root prim.                                                                                        |

Optional: `nestoria_chime` sound, couple hug animation (extend the script's
`Hug` branch with `llRequestPermissions` + `llStartAnimation` if you add one).

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
