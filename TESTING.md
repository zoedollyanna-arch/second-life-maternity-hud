# Nestoria — two-person test plan

Everything below is runnable by two people in one sitting. It covers pairing,
the RP event system, every partner interaction, and a full labor and birth.

You need:

- **Person A (Mom)** — wears the Main HUD (`nestoria_main_hud.lsl` in the root
  prim), plus the Belly if you have it.
- **Person B (Partner)** — wears the Partner HUD (`nestoria_partner_hud.lsl`).
- Both viewers: **Preferences → Sound & Media → Media → enabled**, and *Allow
  media to auto-play*. Without this the HUD screen stays blank.

Both scripts point at `https://second-life-maternity-hud-t2b3.onrender.com`.
If you have redeployed elsewhere, edit `API_BASE` and `API_SECRET` at the top of
each script — `API_SECRET` must equal `SL_API_SECRET` in the server `.env`.

> The server sleeps on Render's free tier. The first HUD touch after a quiet
> period can take ~30 seconds while it wakes. Touch the HUD again if the screen
> is still blank.

---

## 1. Pairing (5 minutes)

| # | Who | Do this | Expect |
|---|-----|---------|--------|
| 1 | A | Wear the Main HUD, touch it | Dashboard loads on the screen face |
| 2 | A | Complete the setup wizard (name, week, baby count, gender) | Home screen with meters |
| 3 | A | **More → Partner** | A 6-character pairing code |
| 4 | B | Wear the Partner HUD, touch it, enter A's code | "Request sent" |
| 5 | A | Home shows a link approval card | Accept it |
| 6 | B | Partner HUD reloads | Her week, mood and meters appear |

**If step 6 shows nothing:** she has privacy set to *Only me*. Have her open
**Settings → Privacy** and choose *Partner only*.

---

## 2. RP events — the popup system (10 minutes)

This is the part that was rebuilt. There are now **38 distinct events** (23
situations plus 15 mood swings) instead of a fixed handful, each with its own
buttons, and the roller refuses to repeat what just fired.

| # | Who | Do this | Expect |
|---|-----|---------|--------|
| 1 | A | **Settings → Events** | Frequency, surface, and 8 category switches |
| 2 | A | Set *Where they appear* to **HUD screen + in-world menu** | — |
| 3 | A | Press **Give me a moment now** | A card at the top of the HUD **and** a blue menu, with the *same* buttons |
| 4 | A | Answer it from the blue menu | Card disappears; an RP line in chat |
| 5 | A | Press **Give me a moment now** ten times | Ten *different* moments. No back-to-back repeats |
| 6 | A | Answer one on the **HUD card** instead | Blue menu answer for the same event now says "that moment has already passed" |
| 7 | A | Switch off **Mood swings** and **Sickness**, roll ten more | Nothing from those two families appears |
| 8 | A | Set surface to **HUD screen only**, roll | Card appears, no blue menu |
| 9 | A | Set surface to **Nothing — quiet mode**, roll | Nothing interrupts; the event still lands in **Alerts** |
| 10 | A | Set surface back to both, roll, then **ignore it for 12 minutes** | It lapses on its own and a new one can arrive |

**What to look for:** the buttons should *fit the moment*. Nausea offers ginger
ale, medicine and "let it happen". A kick offers "talk to the baby" and "share
it". A mood swing offers what that feeling actually needs. If you ever see the
same five buttons twice in a row for different events, that is a bug — say so.

### Events react to her state

| # | Who | Do this | Expect |
|---|-----|---------|--------|
| 1 | A | Let hydration and energy fall (or set **Settings → Realism → Realistic**) | Tired, dizzy and thirsty moments become far more likely |
| 2 | A | Eat several desserts on **Nutrition** | Nutrition drops; sickness-flavoured events increase |
| 3 | A | Answer a moment with **Ask your partner for help** | B is notified in-world and on their HUD |
| 4 | B | Send hugs and back rubs for a few minutes | Her *lonely* and *sad* moments get rarer; *happy* and *calm* get commoner |
| 5 | A | Unlink the partner (**Partner → remove**) | *Lonely* becomes much more likely again |

---

## 3. Preferences (5 minutes)

| # | Who | Do this | Expect |
|---|-----|---------|--------|
| 1 | A | **Settings → Sound** → turn HUD sounds off | Buttons are silent; nothing chimes |
| 2 | A | Turn sound on, drag volume to 20% | Noticeably quieter |
| 3 | A | Switch off **Vomiting animation & particles** | **Care → Be sick** still changes meters, but no particles or pose |
| 4 | A | Switch off **Bathroom prop & pose** | **Care → Bathroom** relieves the meter with no prop rezzed |
| 5 | A | **Settings → Privacy** → switch off **Mood swings** under *what reaches your partner* | B stops being pinged about her moods; everything else still arrives |
| 6 | A | **Settings → Realism** → **Gentle** | Meters visibly drift slower |
| 7 | A | Switch off **Pica cravings** | Corn starch / chalk moments never fire |

Every one of these is enforced on the server, not just hidden in the interface.

---

## 4. Partner interactions (10 minutes)

Run through B's HUD. Everything she has consented to should work; everything
she has not should refuse with a clear reason rather than failing silently.

Out of the box: **fetching and carrying lands straight away** (water, vitamins,
help resting, ice chips), while **physical contact asks first** (hug, kiss, back
rub, feeling the baby kick). She can change either, per action, on
**Partner → Privacy → Ask before**.

| # | Who | Do this | Expect |
|---|-----|---------|--------|
| 1 | B | **Her** → Check on her | A summary in words, limited to what she permits |
| 2 | B | Bring water, bring vitamins, help her rest | Land immediately; her meters move and she sees each one in-world |
| 3 | B | Send a **hug** | A gets a request card; nothing happens until she answers |
| 4 | A | Accept it | The hug lands; B sees it confirmed |
| 5 | B | Send another hug; A **declines** it | B is told, politely. No meters move |
| 6 | A | **Partner → Privacy → Ask before** → switch hugs to automatic | — |
| 7 | B | Send a hug | Lands straight away, no request |
| 8 | A | **Partner → Privacy → "Your partner can do"** → switch off **Hug, kiss, feel kicks** | — |
| 9 | B | Try a hug or a back rub | Refused: "she has turned that off in her privacy settings" |
| 10 | A | Switch it back on | — |
| 11 | B | **Feel the baby kick** with no recent kick | Refused — B reacts to kicks, never causes one |
| 12 | A | **Baby → Log a kick**; B tries again within 10 minutes | Works |
| 13 | B | Try **Ice chips** before labor | Unavailable — ice chips are a labor action (see §5) |
| 14 | Both | **Hospital bag** — tick items from both HUDs | Each item shows who packed it, live on both screens |
| 15 | Both | **Milestones** — celebrate one from each side | Both names appear on it |
| 16 | A | **Partner → Privacy** → switch off **Your mood** | B's "How she is" and "What she's going through" panels disappear |

---

## 5. Labor and birth (10 minutes, with test mode)

Labor normally starts on its own somewhere in weeks 37–42 and runs for 45–240
real minutes. For a test session, use test mode.

**Unlock it:** A opens **Settings → Realism**, scrolls to *Testing*, and enters
the code:

```
nestoria-test
```

(Override it in production with the `HUD_TEST_CODE` environment variable.)

| # | Who | Do this | Expect |
|---|-----|---------|--------|
| 1 | A | **Jump to week** 38 | Week updates everywhere, including on B's HUD |
| 2 | A | **Labor speed → 25×** | "full labor now runs about N minutes" |
| 3 | A | **Start labor now** | Within a few seconds: contractions begin |
| 4 | B | Watch the Partner HUD | "She is in labor" — unprompted, on their own screen |
| 5 | B | Comfort her, guide breathing, hold her hand | Her stress drops; each one is logged. Labor support never asks first |
| 6 | B | Try to bring **water** | Refused — "no water during labor, offer ice chips instead" |
| 7 | B | Bring **ice chips** | Now available, and works |
| 8 | Both | Wait | Waters break, then "time for the hospital", both notified |
| 9 | A | **Care → Pack bag**, then go to hospital | Bed rezzes if it is in the HUD's contents |
| 10 | Both | Wait through transition → pushing | Intensity climbs to 100%; B's birth actions unlock |
| 11 | B | Try **Faint** or **Stay strong** | Plays on B's own avatar, never on hers |
| 12 | Both | Wait | The baby arrives. Both HUDs announce it together |
| 13 | A | **Reset labor** | Pregnancy is active again, ready for another run |
| 14 | A | **Turn off & restore** | Real labor timing is put back |

**Important:** always finish with *Turn off & restore*. Leaving test mode on
means the pregnancy keeps the sped-up plan.

---

## 6. Robustness

| # | Do this | Expect |
|---|---------|--------|
| 1 | A detaches the HUD mid-popup, re-attaches | The moment is still waiting on the screen |
| 2 | A teleports to another region | Screen reloads and reconnects on its own |
| 3 | Both press the same button at the same moment | Applied once, not twice |
| 4 | A closes the HUD for an hour | Meters have drifted, but gently — not to zero |
| 5 | B opens their HUD before A has ever opened hers | Reads the pregnancy correctly, decays nothing wrongly |

---

## Reporting a problem

Please note, for anything that misbehaves:

1. Which HUD (Mom / Partner) and which screen
2. What you pressed
3. What happened vs what you expected
4. The exact time, so it can be found in the action log

Server-side, every button press is recorded in `action_log`, every event in
`event_history`, and every shared moment in `pregnancy_events`.
