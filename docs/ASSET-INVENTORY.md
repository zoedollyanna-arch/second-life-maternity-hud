# Nestoria asset inventory

Everything the system uses: in-world objects, scripts, animations, sounds, foods, and the hospital-bag checklist.

Sounds and animations are optional. The dashboard already plays synthesized audio through the media screen, and the HUD skips any inventory item that is missing. Names must match exactly.

## Objects

| Inventory name | Required | Script | What it does |
| --- | --- | --- | --- |
| Main HUD (tablet / screen prim) | Yes | `nestoria_main_hud.lsl`, `nestoria_hud_media.lsl`, `nestoria_hud_effects.lsl` | All three in the root prim, compiled with Mono. Face 4 is the media screen; dimensions are configured in the media helper. |
| `nestoria_chair` | Yes, for Comfort | `nestoria_comfort_chair.lsl` | Rezzed from the HUD. Wearer sits 2 minutes, then it cleans itself up. |
| Belly sensor prim | Recommended | `nestoria_belly.lsl` | Worn on the stomach. Script makes it invisible. Handles kicks, heartbeat, and bump touches. |
| `nestoria_hospital_bag` | Recommended | `nestoria_hospital_bag.lsl` | Worn, not rezzed. Open or touch to pack. Separate from the 18-item HUD checklist. |
| `nestoria_toilet` | Optional | `nestoria_toilet.lsl` | Bathroom rezzes it if it is in the HUD, or talks to one already placed. |
| `nestoria_hospital_bed` | Optional | `nestoria_hospital_bed.lsl` | Place in-world, or keep a copy in the HUD. Labor scenes talk to it. |
| `nestoria_mess` | Optional | None yet | Rezzed on the floor when she is sick. Needs its own cleanup script. |
| Partner HUD (tablet / screen prim) | Recommended | `nestoria_partner_hud.lsl` | Face 4 loads the partner page. |

Hand-held props (foods, water, vitamins) each use `nestoria_prop.lsl`. See [Hand-held props](#hand-held-props).

Optional extras that are not scripted yet: heart and sparkle particle textures, a doctor clipboard, a stethoscope, and a product box with landmark and notecard. A logo texture can go on the HUD frame (`src/assets/nestoria-logo.png`).

### Main HUD contents

Required:

- `nestoria_main_hud.lsl`
- `nestoria_hud_media.lsl`
- `nestoria_hud_effects.lsl`
- `nestoria_chair`

Optional objects: `nestoria_hospital_bed`, `nestoria_toilet`, `nestoria_mess`.

Optional animations and sounds are listed below.

## Scripts

| File | Goes in |
| --- | --- |
| `lsl/nestoria_main_hud.lsl` | Main HUD root prim |
| `lsl/nestoria_hud_media.lsl` | Same Main HUD root prim, Mono |
| `lsl/nestoria_hud_effects.lsl` | Same Main HUD root prim, Mono |
| `lsl/nestoria_comfort_chair.lsl` | Comfort chair |
| `lsl/nestoria_belly.lsl` | Belly sensor prim |
| `lsl/nestoria_hospital_bag.lsl` | Worn hospital bag |
| `lsl/nestoria_hospital_bed.lsl` | Hospital bed |
| `lsl/nestoria_toilet.lsl` | Toilet |
| `lsl/nestoria_partner_hud.lsl` | Partner HUD root prim |
| `lsl/nestoria_prop.lsl` | Every hand-held food, bottle, and vitamin |

## Animations

Drop these into the object named in the last column. A fallback plays until the named animation is added. An empty fallback means the action stays silent.

### Main HUD

| Name | Plays when | Fallback | Priority |
| --- | --- | --- | --- |
| `nestoria_rest` | Rest, and as the fallback for several others | — | First |
| `nestoria_drink` | Drink water, ice chips | — | First |
| `nestoria_vitamins` | Take vitamins | — | First |
| `nestoria_belly_hold` | Hold belly, rub belly, feeling a kick | — | First |
| `nestoria_sleep` | Sleep, nap | `nestoria_rest` | High |
| `nestoria_vomit` | Being sick | `nestoria_rest` | High |
| `nestoria_cry` | Crying and emotional mood swings | none | High |
| `nestoria_yawn` | Sleepy and tired moods, can't sleep | `nestoria_rest` | Medium |
| `nestoria_bathroom` | Bathroom break | none | Medium |
| `nestoria_contraction` | Contractions during labor | `nestoria_rest` | Medium |
| `nestoria_comfort` | Comfort, alongside the chair | none | Low |

### Partner HUD

| Name | Plays when |
| --- | --- |
| `nestoria_faint` | Optional birth reaction “Feel faint” |
| `nestoria_vomit` | Optional birth reaction “Get queasy” |

Both reactions are roleplay only. The server ignores them when deciding labor.

### Hand-held props

| Name | Anim type in the description |
| --- | --- |
| `nestoria_eat` | `eat` |
| `nestoria_drink` | `drink` |
| `nestoria_hold` | `hold` (prenatal vitamins) |

## Sounds

### In-world clips

Present means played. Missing means skipped. The media screen still makes its own audio.

| Name | Where | Plays when | Priority |
| --- | --- | --- | --- |
| `nestoria_chime` | Main HUD, Partner HUD | Notifications, hearts, vitamins, labor beats. Also the fallback for vomit. | First |
| `nestoria_heartbeat` | Main HUD, belly sensor | Doctor, ultrasound, contractions | First |
| `nestoria_sip` | Main HUD | Drinking | High |
| `nestoria_vomit` | Main HUD | Being sick | High |
| `nestoria_cry` | Main HUD | Crying | Medium |
| `nestoria_yawn` | Main HUD | Sleepy moods, going to sleep | Low |
| `nestoria_kick` | Belly sensor | Baby kicks | — |

### Dashboard sounds (no files)

These are generated in the browser with the Web Audio API and heard in Second Life through media audio.

| Function | What you hear | Used for |
| --- | --- | --- |
| `playChime` | Two-note bell | Confirmations, notifications, and any action without its own sound |
| `playHearts` | Rising arpeggio | Hugs, hearts, hold belly, support, memories |
| `playWater` | Pour / sip | Drink water, partner water, warm bath |
| `playHeartbeat` | Four lub-dubs, ~145 bpm | Heartbeat, doctor, ultrasound |
| `playKick` | Single soft thump | Kick, feel kick, count kicks, talk to baby |
| `playMunch` | Crunch | Eat, food, snack, craving choice |
| `playPop` | Bottle pop plus chime | Vitamins |
| `playRelax` | Descending pad | Rest, sleep, comfort, breathe, partner rest and breathing |
| `playError` | Low buzz | Errors |
| `playEvent` | Rising two-note prompt | A random roleplay moment waiting for an answer |

## Foods

61 items. Eating them on the dashboard changes stats. Only the 20 props in the next section have in-world meshes specified.

### Breakfast

| Key | Name |
| --- | --- |
| `french_toast` | French toast |
| `jam_toast` | Jam toast |
| `eggs` | Scrambled eggs |
| `pancakes` | Pancakes |
| `waffles` | Waffles |
| `cereal` | Cereal |
| `oatmeal` | Oatmeal |
| `toast` | Buttered toast |

### Meals

| Key | Name |
| --- | --- |
| `ham_sub` | Ham sub |
| `spaghetti` | Spaghetti |
| `chicken_bacon_burger` | Chicken bacon burger |
| `lasagna` | Lasagna |
| `cheeseburger` | Cheeseburger |
| `chicken_dinner` | Roast chicken |
| `steak` | Steak |
| `fish` | Baked fish |
| `rice_bowl` | Rice bowl |
| `soup` | Chicken soup |
| `salad` | Garden salad |

### Snacks

| Key | Name |
| --- | --- |
| `pickle_chips` | Pickle chips |
| `chips` | Crisps |
| `crackers` | Crackers |
| `cookies` | Cookies |
| `popcorn` | Popcorn |
| `pretzels` | Pretzels |
| `granola_bar` | Granola bar |
| `fruit_snacks` | Fruit snacks |

### Fruits

| Key | Name |
| --- | --- |
| `strawberries` | Strawberries |
| `watermelon` | Watermelon |
| `grapes` | Grapes |
| `apple` | Apple |
| `banana` | Banana |
| `orange` | Orange |
| `pineapple` | Pineapple |
| `mango` | Mango |
| `peach` | Peach |

### Drinks

| Key | Name |
| --- | --- |
| `lemonade` | Lemonade |
| `ginger_ale` | Ginger ale |
| `ice_chips` | Ice chips |
| `juice` | Orange juice |
| `milk` | Milk |
| `smoothie` | Fruit smoothie |
| `tea` | Herbal tea |
| `protein_shake` | Protein shake |
| `coconut_water` | Coconut water |

### Desserts

| Key | Name |
| --- | --- |
| `ice_cream` | Ice cream |
| `chocolate_bar` | Chocolate bar |
| `cake` | Cake |
| `cupcake` | Cupcake |
| `donut` | Donut |
| `brownie` | Brownie |
| `cheesecake` | Cheesecake |
| `pudding` | Pudding |

### Cravings

| Key | Name |
| --- | --- |
| `pizza` | Pizza |
| `pickles` | Pickles |
| `pasta_craving` | Buttery pasta |
| `strawberries_cream` | Strawberries & cream |
| `spicy_food` | Something spicy |
| `olives` | Olives |

### Pica

| Key | Name |
| --- | --- |
| `corn_starch` | Corn starch |
| `chalk` | Chalk |

## Hand-held props

One mesh per row. Drop in `nestoria_prop.lsl`, paste the description, and optionally add `nestoria_eat`, `nestoria_drink`, or `nestoria_hold`.

Description format: `action|param|animtype|seconds|Display Name`

| Item | Description |
| --- | --- |
| Ham sub | `food_eat\|ham_sub\|eat\|35\|Ham Sub` |
| Spaghetti | `food_eat\|spaghetti\|eat\|40\|Spaghetti` |
| Chicken bacon burger | `food_eat\|chicken_bacon_burger\|eat\|35\|Chicken Bacon Burger` |
| Lasagna | `food_eat\|lasagna\|eat\|40\|Lasagna` |
| Jam toast | `food_eat\|jam_toast\|eat\|20\|Jam Toast` |
| Cheeseburger | `food_eat\|cheeseburger\|eat\|30\|Cheeseburger` |
| French toast | `food_eat\|french_toast\|eat\|25\|French Toast` |
| Pickle chips | `food_eat\|pickle_chips\|eat\|30\|Pickle Chips` |
| Chocolate bar | `food_eat\|chocolate_bar\|eat\|25\|Chocolate Bar` |
| Pizza | `food_eat\|pizza\|eat\|35\|Pizza` |
| Pickles | `food_eat\|pickles\|eat\|25\|Pickles` |
| Ice cream | `food_eat\|ice_cream\|eat\|25\|Ice Cream` |
| Strawberries | `food_eat\|strawberries\|eat\|20\|Strawberries` |
| Watermelon | `food_eat\|watermelon\|eat\|20\|Watermelon` |
| Lemonade | `food_eat\|lemonade\|drink\|20\|Lemonade` |
| Ginger ale | `food_eat\|ginger_ale\|drink\|20\|Ginger Ale` |
| Ice chips | `food_eat\|ice_chips\|drink\|15\|Ice Chips` |
| Corn starch | `food_eat\|corn_starch\|eat\|20\|Corn Starch` |
| Chalk | `food_eat\|chalk\|eat\|20\|Chalk` |
| Water bottle | `drink_water\|\|drink\|20\|Water Bottle` |
| Vitamin bottle | `vitamins\|\|hold\|12\|Prenatal Vitamins` |

The other 41 foods exist on the dashboard only. They do not have a prop description yet.

## Hospital bag checklist

18 items, shared between her HUD and the Partner HUD. This list is separate from the worn `nestoria_hospital_bag` object.

**Mom:** ID & insurance, prenatal records, maternity pads, comfy clothes, going-home outfit, underwear.

**Personal:** socks & slippers, toiletries, hair ties & brush, phone charger, snacks & drinks, ice chips & hard candy.

**Baby:** baby car seat, blanket, baby outfit, diapers & wipes, pacifier, other essentials.

## Ultrasound photos

Ten images in the web app, named `ultrasound-01.jpg` through `ultrasound-10.jpg` under `/ultrasounds/`. Nothing to build in-world.

| Photo | Unlocks at week |
| --- | --- |
| 01 | 6 |
| 02 | 9 |
| 03 | 12 |
| 04 | 16 |
| 05 | 20 |
| 06 | 24 |
| 07 | 28 |
| 08 | 32 |
| 09 | 36 |
| 10 | 39 |
