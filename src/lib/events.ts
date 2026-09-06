// Nestoria RP event engine — shared catalogue.
//
// This file is the single source of truth for *what can pop up* and *what she
// can do about it*, and it is imported by three places at once:
//
//   * the server (game.ts) rolls an event from it and applies the chosen effect
//   * the HUD dashboard renders the popup card and its buttons from it
//   * the in-world LSL dialog is built from the same choice list the server
//     sends down, so the blue menu finally matches the event that fired
//
// The old engine was a fixed if/else chain with a 52% mood branch and one
// hardcoded set of five buttons, which is why the same handful of moments kept
// coming back. Here every event carries its own weight function, several body
// variants, and its own choices — and the roller penalises whatever fired
// recently, so a session moves through the catalogue instead of orbiting it.

import { MOOD_CATALOG, MOOD_KEYS, rpLineFor, type MoodKey } from "./mood";
import type { StatName } from "./foods";

// ---------------------------------------------------------------------------
// Categories — each one is a preference the wearer can switch off.
// ---------------------------------------------------------------------------

export const EVENT_CATEGORIES = [
  "mood",
  "sickness",
  "craving",
  "baby",
  "body",
  "nesting",
  "partner",
  "sweet",
] as const;

export type EventCategory = (typeof EVENT_CATEGORIES)[number];

export const EVENT_CATEGORY_LABELS: Record<EventCategory, string> = {
  mood: "Mood swings",
  sickness: "Sickness & nausea",
  craving: "Cravings",
  baby: "Baby movement",
  body: "Body & aches",
  nesting: "Nesting",
  partner: "Partner prompts",
  sweet: "Quiet sweet moments",
};

export const EVENT_CATEGORY_HINTS: Record<EventCategory, string> = {
  mood: "Emotional swings that follow your meters — happy, weepy, touched out.",
  sickness: "Nausea, heartburn, dizziness and food aversions.",
  craving: "Sudden wants. Pickles at 3am, ice cream, chalk.",
  baby: "Kicks, rolls, hiccups and quiet flutters.",
  body: "Backache, swollen feet, Braxton Hicks, bladder urgency.",
  nesting: "The urge to fold, sort, scrub and prepare.",
  partner: "Moments that nudge you to reach for your partner.",
  sweet: "Small lovely beats — daydreams, name lists, heartbeat moments.",
};

// ---------------------------------------------------------------------------
// Choices.
//
// `short` is what goes on an llDialog button: Second Life truncates at 24
// characters and the grid renders them tiny, so these are kept under 20.
// `key` values that existed in the old engine are preserved so historical
// event_history rows still resolve.
// ---------------------------------------------------------------------------

export interface EventChoice {
  key: string;
  /** Full label for the HUD screen. */
  label: string;
  /** ≤19 chars — the in-world blue-menu button. */
  short: string;
  deltas: Partial<Record<StatName, number>>;
  /** RP line said back to her when she picks it. `{m}` = her name. */
  line: string;
  /** Optional in-world command queued to her HUD when chosen. */
  world?: string;
  /** Ask the partner for something / tell them she needs them. */
  notifiesPartner?: boolean;
  /** Write the moment into her journal. */
  journals?: boolean;
  /** Mood she tends to land on afterwards. */
  moodAfter?: MoodKey;
}

export const CHOICE_CATALOG: Record<string, EventChoice> = {
  // --- comfort & care ------------------------------------------------------
  rest: {
    key: "rest",
    label: "Sit down and rest",
    short: "Rest",
    deltas: { rest: 10, energy: 6, sickness: -5, stress: -4 },
    line: "{m} lowers herself down and lets everything stop for a minute.",
    world: "rest",
    moodAfter: "calm",
  },
  nap: {
    key: "nap",
    label: "Lie down for a nap",
    short: "Nap",
    deltas: { energy: 20, rest: 18, mood: 5, stress: -6 },
    line: "{m} curls up and is asleep faster than she expected.",
    world: "sleep",
    moodAfter: "calm",
  },
  water: {
    key: "water",
    label: "Drink some water",
    short: "Water",
    deltas: { hydration: 16, baby_wellness: 2, sickness: -2 },
    line: "{m} drinks, and only then realises how thirsty she was.",
    world: "drink",
  },
  ice_chips: {
    key: "ice_chips",
    label: "Crunch some ice chips",
    short: "Ice chips",
    deltas: { hydration: 8, comfort: 6, sickness: -4, mood: 3 },
    line: "{m} crunches cold ice. It helps more than it should.",
  },
  ginger: {
    key: "ginger",
    label: "Sip ginger ale",
    short: "Ginger ale",
    deltas: { sickness: -10, hydration: 8, comfort: 4 },
    line: "{m} sips ginger ale slowly and waits for her stomach to settle.",
  },
  medicine: {
    key: "medicine",
    label: "Take the nausea medicine",
    short: "Medicine",
    deltas: { sickness: -22, comfort: 5, stress: -2 },
    line: "{m} takes her medicine and lies back to let it work.",
  },
  vitamins: {
    key: "vitamins",
    label: "Take your vitamins",
    short: "Vitamins",
    deltas: { vitamins: 25, immunity: 8, nutrition: 5, baby_wellness: 3 },
    line: "{m} swallows her prenatal with a grimace and a glass of water.",
    world: "vitamins",
  },
  snack: {
    key: "snack",
    label: "Have a small snack",
    short: "Snack",
    deltas: { hunger: 12, sickness: -6, mood: 3, nutrition: 2 },
    line: "{m} nibbles something plain until the worst of it passes.",
  },
  eat_craving: {
    key: "eat",
    label: "Give in and eat it",
    short: "Eat it",
    deltas: { hunger: 20, mood: 12, nutrition: -1, sickness: 3 },
    line: "{m} gives in completely, and regrets nothing.",
    moodAfter: "happy",
  },
  healthy_swap: {
    key: "healthy",
    label: "Swap for something kinder",
    short: "Healthy swap",
    deltas: { hunger: 12, nutrition: 8, mood: 3, baby_wellness: 3 },
    line: "{m} finds something gentler that scratches most of the itch.",
  },
  bathroom: {
    key: "bathroom",
    label: "Go to the bathroom",
    short: "Bathroom",
    deltas: { bladder: 90, comfort: 6 },
    line: "{m} makes it just in time. Again.",
    world: "bathroom",
  },
  warm_bath: {
    key: "warm_bath",
    label: "Run a warm bath",
    short: "Warm bath",
    deltas: { comfort: 16, stress: -8, mood: 6, energy: 4 },
    line: "{m} sinks into warm water and lets her back stop aching.",
    moodAfter: "calm",
  },
  prop_feet: {
    key: "prop_feet",
    label: "Put your feet up",
    short: "Feet up",
    deltas: { comfort: 12, rest: 6, stress: -4 },
    line: "{m} props her feet up and sighs like she has been holding it in all day.",
  },
  stretch: {
    key: "stretch",
    label: "Stretch it out slowly",
    short: "Stretch",
    deltas: { comfort: 10, energy: 4, stress: -3 },
    line: "{m} stretches carefully, hand braced on the small of her back.",
  },
  breathe: {
    key: "breathe",
    label: "Breathe through it",
    short: "Breathe",
    deltas: { stress: -9, mood: 5, comfort: 4 },
    line: "{m} breathes in for four, out for six, until the wave passes.",
    moodAfter: "calm",
  },
  vomit: {
    key: "vomit",
    label: "Let it happen",
    short: "Be sick",
    deltas: { sickness: -30, hydration: -8, energy: -6, comfort: -4, mood: 4 },
    line: "{m} is sick, and afterwards feels hollow but honestly better.",
    world: "vomit",
  },
  lie_on_side: {
    key: "lie_on_side",
    label: "Lie on your left side",
    short: "Lie down",
    deltas: { comfort: 12, rest: 8, baby_wellness: 3, stress: -4 },
    line: "{m} rolls onto her left side and waits for the room to stop tilting.",
  },

  // --- baby ---------------------------------------------------------------
  rub_belly: {
    key: "rub_belly",
    label: "Rub your belly",
    short: "Rub belly",
    deltas: { baby_bond: 6, mood: 6, comfort: 4 },
    line: "{m} draws slow circles on her bump until the little one settles.",
    world: "belly_hold",
    moodAfter: "calm",
  },
  count_kick: {
    key: "count_kick",
    label: "Count the kicks",
    short: "Count kicks",
    deltas: { baby_movement: 6, baby_bond: 3, mood: 3 },
    line: "{m} counts, hand flat, waiting for each nudge.",
  },
  talk_to_baby: {
    key: "talk_to_baby",
    label: "Talk to the baby",
    short: "Talk to baby",
    deltas: { baby_bond: 8, mood: 7, stress: -4 },
    line: "{m} murmurs to her bump like nobody could possibly overhear.",
    moodAfter: "happy",
  },
  photo: {
    key: "photo",
    label: "Take a bump photo",
    short: "Bump photo",
    deltas: { mood: 8, baby_bond: 4 },
    line: "{m} takes a photo of the bump. One for the album, six for the bin.",
    journals: true,
    moodAfter: "happy",
  },

  // --- emotional ----------------------------------------------------------
  sit_with_it: {
    key: "sit_with_it",
    label: "Just sit with it",
    short: "Sit with it",
    deltas: { mood: 4, stress: -6, comfort: 3 },
    line: "{m} doesn't fix it. She just lets herself feel it, and it passes.",
  },
  cry_it_out: {
    key: "cry_it_out",
    label: "Have a good cry",
    short: "Cry it out",
    deltas: { mood: 6, stress: -14, energy: -4 },
    line: "{m} cries properly, and afterwards the world is a size she can hold.",
    world: "cry",
    moodAfter: "calm",
  },
  laugh_it_off: {
    key: "laugh_it_off",
    label: "Laugh at yourself",
    short: "Laugh",
    deltas: { mood: 9, stress: -6 },
    line: "{m} catches how ridiculous it is and laughs until it stops mattering.",
    moodAfter: "happy",
  },
  journal: {
    key: "journal",
    label: "Write it down",
    short: "Journal it",
    deltas: { mood: 5, stress: -4 },
    line: "{m} writes it down so she remembers this exact feeling later.",
    journals: true,
  },
  organize: {
    key: "organize",
    label: "Sort something out",
    short: "Organise",
    deltas: { mood: 9, stress: -5, energy: -5 },
    line: "{m} refolds the same tiny clothes for the fourth time and feels better.",
  },
  pack_bag: {
    key: "pack_bag",
    label: "Add to the hospital bag",
    short: "Pack bag",
    deltas: { mood: 7, stress: -6 },
    line: "{m} adds one more thing to the bag by the door.",
  },

  // --- partner ------------------------------------------------------------
  ask_partner: {
    key: "ask_partner",
    label: "Ask your partner for help",
    short: "Ask partner",
    deltas: { mood: 4, stress: -4, comfort: 3 },
    line: "{m} reaches out instead of white-knuckling it alone.",
    notifiesPartner: true,
  },
  want_company: {
    key: "want_company",
    label: "Ask them to just sit with you",
    short: "Want company",
    deltas: { mood: 6, stress: -6, comfort: 5 },
    line: "{m} doesn't want it solved. She wants somebody in the room.",
    notifiesPartner: true,
  },
  share_it: {
    key: "share_it",
    label: "Share the moment with them",
    short: "Share it",
    deltas: { mood: 8, baby_bond: 4 },
    line: "{m} tells her partner immediately, because it is too good to keep.",
    notifiesPartner: true,
    moodAfter: "excited",
  },

  // --- opt out ------------------------------------------------------------
  ignore: {
    key: "ignore",
    label: "Push through it",
    short: "Push through",
    deltas: { mood: -3, stress: 4, energy: -3 },
    line: "{m} ignores it and carries on. Her body files a complaint for later.",
  },
};

/** Choice keys are stored in event_history; resolve unknown ones safely. */
export function choiceByKey(key: string): EventChoice | undefined {
  const direct = CHOICE_CATALOG[key];
  if (direct) return direct;
  return Object.values(CHOICE_CATALOG).find((c) => c.key === key);
}

// ---------------------------------------------------------------------------
// Weighting context
// ---------------------------------------------------------------------------

export interface EventContext {
  trimester: 1 | 2 | 3;
  week: number;
  stats: Record<StatName, number>;
  /** Her current emotional state, from the last mood event. */
  mood: MoodKey;
  partnerLinked: boolean;
  /** 0–100, rolling 7-day partner support. */
  partnerSupport: number;
  inLabor: boolean;
  /** Event keys that fired recently, newest first. */
  recentKeys: string[];
  /** Categories the wearer has switched off. */
  disabled: Set<EventCategory>;
}

export interface EventDefinition {
  key: string;
  category: EventCategory;
  title: string;
  /** Several variants so the same event never reads identically twice. */
  bodies: string[];
  deltas: Partial<Record<StatName, number>>;
  /** 3–5 choice keys. The first is the "obvious" one. */
  choices: string[];
  /** Mood she is pushed toward when this fires. */
  moodAfter?: MoodKey;
  /** In-world command queued when the event fires (not when answered). */
  world?: string;
  /** Tell the partner this happened. */
  notifyPartner?: boolean;
  /** 0 means "cannot fire right now". */
  weight: (c: EventContext) => number;
}

const lack = (v: number, threshold: number) => Math.max(0, threshold - v) / threshold;
const over = (v: number, threshold: number) =>
  Math.max(0, v - threshold) / Math.max(1, 100 - threshold);

// ---------------------------------------------------------------------------
// The catalogue
// ---------------------------------------------------------------------------

export const EVENT_DEFINITIONS: EventDefinition[] = [
  // ---- sickness ----------------------------------------------------------
  {
    key: "nausea",
    category: "sickness",
    title: "A wave of nausea",
    bodies: [
      "It rises out of nowhere — the smell of something three rooms away, and suddenly she has to stand very still.",
      "Her stomach turns over slowly, like it is thinking about it. She swallows hard and waits.",
      "The nausea arrives with no warning and no manners at all.",
    ],
    deltas: { sickness: 8, mood: -3, stress: 3 },
    choices: ["ginger", "snack", "medicine", "vomit", "rest"],
    moodAfter: "overwhelmed",
    weight: (c) =>
      (c.trimester === 1 ? 3 : c.trimester === 2 ? 0.8 : 1.4) *
      (1 + over(c.stats.sickness, 40) * 3) *
      (1 + lack(c.stats.hunger, 40)),
  },
  {
    key: "heartburn",
    category: "sickness",
    title: "Heartburn",
    bodies: [
      "A slow burn climbs her chest. She was warned about this and did not believe it.",
      "Everything she ate an hour ago would like a word.",
      "She sits up straighter, as though geometry could fix it.",
    ],
    deltas: { sickness: 5, comfort: -5, stress: 2 },
    choices: ["water", "ice_chips", "prop_feet", "medicine", "ignore"],
    weight: (c) => (c.trimester === 3 ? 2.4 : 1) * (1 + over(c.stats.hunger, 70) * 2),
  },
  {
    key: "dizzy",
    category: "sickness",
    title: "The room tilts",
    bodies: [
      "She stands up too fast and the edges of everything go soft and grey.",
      "A wave of light-headedness. She puts a hand out for the nearest solid thing.",
      "Dizzy. She stays exactly where she is until the floor agrees to be a floor again.",
    ],
    deltas: { sickness: 5, energy: -6, hydration: -4 },
    choices: ["lie_on_side", "water", "snack", "ask_partner", "rest"],
    moodAfter: "anxious",
    weight: (c) => 1.4 * (1 + lack(c.stats.hydration, 45) * 3) * (1 + lack(c.stats.energy, 40) * 2),
  },
  {
    key: "food_aversion",
    category: "sickness",
    title: "She cannot even look at it",
    bodies: [
      "A food she loved last week is now personally offensive. No warning. No appeal.",
      "The smell of cooking hits her and she has to leave the room.",
      "Her body has quietly blacklisted something and refuses to explain why.",
    ],
    deltas: { hunger: -6, sickness: 4, mood: -3 },
    choices: ["snack", "ginger", "ask_partner", "ignore"],
    weight: (c) => (c.trimester === 1 ? 2.2 : 0.7) * (1 + over(c.stats.sickness, 35)),
  },

  // ---- body --------------------------------------------------------------
  {
    key: "backache",
    category: "body",
    title: "Her back has opinions",
    bodies: [
      "A deep ache settles low in her back and makes itself at home.",
      "She stands, and her spine files a formal complaint.",
      "The ache is not sharp. It is just relentless, and it has been there since lunch.",
    ],
    deltas: { comfort: -8, energy: -3, stress: 3 },
    choices: ["warm_bath", "ask_partner", "stretch", "prop_feet", "rest"],
    weight: (c) => (c.week >= 24 ? 2.6 : 0.6) * (1 + lack(c.stats.comfort, 50) * 2),
  },
  {
    key: "swollen_feet",
    category: "body",
    title: "Her ankles have vanished",
    bodies: [
      "Her shoes fit this morning. They are now a theory.",
      "She looks down and cannot find her ankles anywhere in the vicinity.",
      "Everything below the knee is puffy and warm and faintly ridiculous.",
    ],
    deltas: { comfort: -7, mood: -3 },
    choices: ["prop_feet", "water", "laugh_it_off", "ask_partner"],
    // Nothing swells at nine weeks. Hard gate rather than a small weight.
    weight: (c) => (c.week < 20 ? 0 : c.week >= 28 ? 2.2 : 0.6) * (1 + lack(c.stats.hydration, 50)),
  },
  {
    key: "bladder",
    category: "body",
    title: "Again. Already.",
    bodies: [
      "She went eleven minutes ago. The baby does not care.",
      "There is a small foot somewhere it should not be and the message is urgent.",
      "She has memorised the location of every bathroom within walking distance and she is not sorry.",
    ],
    deltas: { comfort: -5 },
    choices: ["bathroom", "laugh_it_off", "ignore"],
    world: "chime",
    weight: (c) => 1.2 * (1 + lack(c.stats.bladder, 45) * 4) * (c.week >= 26 ? 1.6 : 1),
  },
  {
    key: "braxton_hicks",
    category: "body",
    title: "Her belly goes tight",
    bodies: [
      "Her whole bump draws up hard, holds, and lets go. Practice. Only practice.",
      "A tightening rolls across her belly like a held breath. It is not time. Not yet.",
      "It squeezes, and for a second she stops talking mid-sentence to check.",
    ],
    deltas: { comfort: -6, stress: 6, energy: -2 },
    choices: ["breathe", "water", "lie_on_side", "ask_partner", "rest"],
    moodAfter: "anxious",
    notifyPartner: true,
    weight: (c) => (c.week >= 30 ? 2.4 : c.week >= 24 ? 0.8 : 0) * (1 + over(c.stats.stress, 45)),
  },
  {
    key: "cant_sleep",
    category: "body",
    title: "Three in the morning",
    bodies: [
      "Exhausted, and completely awake. Her body has decided that now is when they think about names.",
      "She has turned over so many times the sheets have given up.",
      "There is no comfortable position left. She has tried them all, twice.",
    ],
    deltas: { rest: -8, energy: -6, mood: -4 },
    choices: ["nap", "warm_bath", "talk_to_baby", "journal", "want_company"],
    moodAfter: "tired",
    world: "yawn",
    weight: (c) => (c.week >= 26 ? 2 : 0.8) * (1 + lack(c.stats.rest, 50) * 3),
  },

  // ---- baby --------------------------------------------------------------
  {
    key: "baby_kick",
    category: "baby",
    title: "A kick",
    bodies: [
      "One clean thump, right under her ribs. Hello to you too.",
      "A nudge from the inside, unmistakable, and she stops whatever she was doing.",
      "A little heel presses out and stays there a second, as if waving.",
    ],
    deltas: { mood: 6, baby_movement: 6, baby_bond: 3 },
    choices: ["rub_belly", "count_kick", "share_it", "talk_to_baby", "photo"],
    world: "kick",
    moodAfter: "happy",
    weight: (c) =>
      (c.week < 16 ? 0 : c.week < 22 ? 1.4 : 2.6) * (1 + over(c.stats.baby_movement, 50)),
  },
  {
    key: "baby_hiccups",
    category: "baby",
    title: "Tiny hiccups",
    bodies: [
      "A rhythmic little tap, tap, tap, low down. The baby has the hiccups.",
      "Small regular bumps, perfectly spaced. She counts them and grins at nothing.",
      "Hiccups. The most absurd, most reassuring feeling in the world.",
    ],
    deltas: { mood: 8, baby_bond: 5, comfort: 3 },
    choices: ["rub_belly", "talk_to_baby", "share_it", "journal"],
    moodAfter: "happy",
    weight: (c) => (c.week < 24 ? 0 : 1.8),
  },
  {
    key: "baby_roll",
    category: "baby",
    title: "A whole slow roll",
    bodies: [
      "Her entire bump shifts as the baby turns over. It is deeply strange and she loves it.",
      "Something rolls under her skin, unhurried, and her belly changes shape as it goes.",
      "The baby stretches out lengthways and every organ she owns makes room.",
    ],
    deltas: { mood: 6, baby_movement: 8, comfort: -3, baby_bond: 4 },
    choices: ["rub_belly", "count_kick", "share_it", "stretch"],
    weight: (c) => (c.week < 20 ? 0 : c.week >= 30 ? 2.2 : 1.4),
  },
  {
    key: "baby_quiet",
    category: "baby",
    title: "Very quiet in there",
    bodies: [
      "She realises she has not felt anything for a while, and her whole body goes still to listen.",
      "No movement. She presses gently, waits, and does not breathe.",
      "Too quiet. She reaches for something cold to drink and counts.",
    ],
    deltas: { stress: 10, mood: -5 },
    choices: ["water", "count_kick", "lie_on_side", "want_company", "talk_to_baby"],
    moodAfter: "anxious",
    notifyPartner: true,
    weight: (c) => (c.week < 24 ? 0 : 1) * (1 + lack(c.stats.baby_movement, 45) * 3),
  },

  // ---- craving -----------------------------------------------------------
  {
    key: "craving_hit",
    category: "craving",
    title: "A craving, immediately",
    bodies: [
      "It arrives fully formed and non-negotiable. She can taste it already.",
      "One specific thing. Nothing else will do and she knows it.",
      "The want is so sudden and so precise that it is almost funny.",
    ],
    deltas: { mood: 4, hunger: -4 },
    choices: ["eat_craving", "healthy_swap", "ask_partner", "journal", "ignore"],
    weight: (c) => 1.8 * (1 + lack(c.stats.hunger, 55) * 2) * (c.trimester === 2 ? 1.3 : 1),
  },
  {
    key: "craving_odd",
    category: "craving",
    title: "That is not food",
    bodies: [
      "She finds herself thinking, seriously, about the smell of chalk dust, and decides not to tell anyone.",
      "A craving for something that is technically not edible. Pregnancy is a strange country.",
      "The urge is for texture, not taste, and it is oddly insistent.",
    ],
    deltas: { mood: 3, nutrition: -3 },
    choices: ["healthy_swap", "snack", "journal", "ask_partner", "ignore"],
    weight: (c) => 0.7 * (1 + lack(c.stats.nutrition, 45) * 2),
  },

  // ---- nesting -----------------------------------------------------------
  {
    key: "nesting",
    category: "nesting",
    title: "It has to be done now",
    bodies: [
      "She is suddenly, urgently certain that the drawer has to be reorganised. Tonight.",
      "The nesting hits like a switch. Everything must be clean and folded and ready.",
      "She has scrubbed a skirting board she has never once looked at before.",
    ],
    deltas: { mood: 7, energy: -6, stress: -4 },
    choices: ["organize", "pack_bag", "ask_partner", "rest", "journal"],
    moodAfter: "excited",
    weight: (c) => (c.week >= 30 ? 2.6 : c.week >= 20 ? 1 : 0.4) * (1 + over(c.stats.energy, 55)),
  },
  {
    key: "bag_thought",
    category: "nesting",
    title: "The bag by the door",
    bodies: [
      "She looks at the hospital bag and mentally repacks it for the ninth time.",
      "One more thing occurs to her that absolutely has to go in the bag.",
      "She checks the bag. Everything is there. She checks it again.",
    ],
    deltas: { stress: -4, mood: 4 },
    choices: ["pack_bag", "ask_partner", "journal", "rest"],
    weight: (c) => (c.week >= 32 ? 2.2 : 0),
  },

  // ---- partner -----------------------------------------------------------
  {
    key: "needs_them",
    category: "partner",
    title: "She wants them here",
    bodies: [
      "Nothing is wrong. She just wants her partner in the room, doing nothing, nearby.",
      "The house is too quiet and she would give a lot for the sound of somebody else in it.",
      "She catches herself listening for the door.",
    ],
    deltas: { mood: -4, stress: 4 },
    choices: ["want_company", "ask_partner", "journal", "sit_with_it"],
    moodAfter: "lonely",
    weight: (c) =>
      (c.partnerLinked ? 1.6 : 2.6) *
      (1 + lack(c.partnerSupport, 50) * 2) *
      (1 + lack(c.stats.mood, 50)),
  },
  {
    key: "wants_touch",
    category: "partner",
    title: "Touch-starved",
    bodies: [
      "She wants hands on her back and somebody to take the weight of the day off her.",
      "A hug would fix approximately eighty percent of this and she knows it.",
      "She would trade a great deal right now for somebody to rub her shoulders.",
    ],
    deltas: { comfort: -6, mood: -3 },
    choices: ["ask_partner", "want_company", "warm_bath", "sit_with_it"],
    weight: (c) => (c.partnerLinked ? 1.8 : 0.6) * (1 + lack(c.stats.comfort, 50) * 2),
  },

  // ---- sweet -------------------------------------------------------------
  {
    key: "daydream",
    category: "sweet",
    title: "A whole future, for a second",
    bodies: [
      "She catches herself picturing a face she has not seen yet, and has to sit down under the weight of it.",
      "For one clear second she can see them at four years old, running, and it undoes her.",
      "She imagines the first time somebody says her name back to her in that small voice.",
    ],
    deltas: { mood: 10, baby_bond: 6, stress: -5 },
    choices: ["journal", "share_it", "talk_to_baby", "photo"],
    moodAfter: "emotional",
    weight: () => 1.4,
  },
  {
    key: "name_list",
    category: "sweet",
    title: "The name list, again",
    bodies: [
      "She says three names out loud to the empty room to hear how they sound.",
      "The list has been rewritten so many times that the first version is unrecognisable.",
      "One name keeps coming back. She has not admitted that to anyone yet.",
    ],
    deltas: { mood: 8, baby_bond: 5 },
    choices: ["journal", "share_it", "talk_to_baby", "sit_with_it"],
    moodAfter: "happy",
    weight: () => 1.2,
  },
  {
    key: "caught_reflection",
    category: "sweet",
    title: "She catches her reflection",
    bodies: [
      "She turns sideways in the mirror and stares at the shape of herself, genuinely amazed.",
      "The bump is real and enormous and hers, and for once she just likes it.",
      "She looks pregnant. Properly, obviously, unmistakably pregnant, and it still surprises her.",
    ],
    deltas: { mood: 9, comfort: 4 },
    choices: ["photo", "share_it", "journal", "rub_belly"],
    moodAfter: "happy",
    // The body text is about an unmistakable bump, so it needs one.
    weight: (c) => (c.week < 14 ? 0 : c.week >= 18 ? 1.6 : 0.6),
  },
  {
    key: "heartbeat_moment",
    category: "sweet",
    title: "She thinks about the heartbeat",
    bodies: [
      "She remembers the sound of it — fast, watery, impossible — and gets stuck there a while.",
      "That sound has been playing in her head all day and she does not want it to stop.",
      "The heartbeat. She has decided it is the best sound that exists.",
    ],
    deltas: { mood: 8, baby_bond: 7, stress: -5 },
    choices: ["talk_to_baby", "share_it", "journal", "rub_belly"],
    moodAfter: "emotional",
    weight: (c) => (c.week >= 10 ? 1.3 : 0.2),
  },
];

export const EVENTS_BY_KEY: Record<string, EventDefinition> = Object.fromEntries(
  EVENT_DEFINITIONS.map((e) => [e.key, e]),
);

// ---------------------------------------------------------------------------
// Mood events.
//
// Mood is not one entry in the table — it is fifteen, so a mood swing competes
// with the rest of the catalogue on equal terms instead of winning half of
// every roll. The choices offered are chosen to fit the feeling.
// ---------------------------------------------------------------------------

const MOOD_CHOICES: Record<MoodKey, string[]> = {
  happy: ["share_it", "photo", "talk_to_baby", "journal"],
  excited: ["share_it", "organize", "journal", "talk_to_baby"],
  calm: ["sit_with_it", "talk_to_baby", "journal", "rest"],
  emotional: ["cry_it_out", "want_company", "journal", "sit_with_it"],
  sad: ["want_company", "cry_it_out", "sit_with_it", "warm_bath"],
  crying: ["cry_it_out", "want_company", "sit_with_it", "journal"],
  frustrated: ["breathe", "laugh_it_off", "organize", "ask_partner"],
  irritated: ["breathe", "snack", "sit_with_it", "ignore"],
  anxious: ["breathe", "want_company", "count_kick", "journal"],
  lonely: ["want_company", "ask_partner", "talk_to_baby", "journal"],
  sleepy: ["nap", "rest", "warm_bath", "ignore"],
  tired: ["rest", "nap", "prop_feet", "ask_partner"],
  exhausted: ["nap", "ask_partner", "warm_bath", "rest"],
  stressed: ["breathe", "warm_bath", "want_company", "organize"],
  overwhelmed: ["breathe", "cry_it_out", "want_company", "sit_with_it"],
};

const MOOD_DELTAS: Record<MoodKey, Partial<Record<StatName, number>>> = {
  happy: { mood: 8, stress: -5 },
  excited: { mood: 9, energy: 4, stress: -3 },
  calm: { mood: 6, stress: -8, comfort: 4 },
  emotional: { mood: -2, stress: -3, comfort: 2 },
  sad: { mood: -6, stress: 2 },
  crying: { mood: -5, stress: -6, comfort: 2, energy: -3 },
  frustrated: { mood: -5, stress: 6 },
  irritated: { mood: -4, stress: 5 },
  anxious: { mood: -4, stress: 8 },
  lonely: { mood: -6, stress: 4 },
  sleepy: { energy: -5, rest: -4 },
  tired: { energy: -7, rest: -5, mood: -2 },
  exhausted: { energy: -12, rest: -8, mood: -4 },
  stressed: { stress: 10, mood: -4 },
  overwhelmed: { stress: 12, mood: -6, comfort: -3 },
};

/** How strongly each mood is pulled by the meters. Mirrors mood.ts weighting. */
function moodWeight(key: MoodKey, c: EventContext): number {
  const s = c.stats;
  let w = 1;

  if (c.trimester === 1) {
    if (key === "emotional") w += 1.6;
    if (key === "crying") w += 1.2;
    if (key === "sleepy") w += 1;
    if (key === "anxious") w += 1;
  } else if (c.trimester === 2) {
    if (key === "happy" || key === "excited") w += 1.5;
    if (key === "calm") w += 1;
  } else {
    if (key === "tired") w += 1.5;
    if (key === "exhausted") w += 1.2;
    if (key === "overwhelmed" || key === "anxious") w += 1;
  }

  switch (key) {
    case "irritated":
      w += lack(s.hunger, 45) * 3 + lack(s.bladder, 35) * 2 + lack(s.comfort, 40) * 2;
      break;
    case "frustrated":
      w += lack(s.hunger, 35) * 3 + lack(s.comfort, 45) * 2;
      break;
    case "anxious":
      w += lack(s.hydration, 45) * 2 + over(s.stress, 45) * 3;
      break;
    case "exhausted":
      w += (lack(s.energy, 30) + lack(s.rest, 30)) * 4;
      break;
    case "tired":
      w += (lack(s.energy, 50) + lack(s.rest, 45)) * 2.5;
      break;
    case "sleepy":
      w += (lack(s.energy, 60) + lack(s.rest, 55)) * 2;
      break;
    case "overwhelmed":
      w += over(s.sickness, 40) * 3 + over(s.stress, 55) * 3;
      break;
    case "stressed":
      w += over(s.stress, 40) * 4;
      break;
    case "crying":
      w += lack(s.mood, 30) * 4 + over(s.sickness, 50) * 2;
      break;
    case "sad":
      w += lack(s.mood, 40) * 3 + (c.partnerLinked ? lack(c.partnerSupport, 30) * 2 : 1);
      break;
    case "lonely":
      w += c.partnerLinked ? lack(c.partnerSupport, 45) * 3 : 3.5;
      break;
    case "happy":
      w += over(s.mood, 65) * 3 + (c.partnerLinked ? over(c.partnerSupport, 55) * 2 : 0);
      break;
    case "calm":
      w += over(s.mood, 60) * 2 + over(s.comfort, 55) * 2;
      break;
    case "excited":
      w += over(s.mood, 60) * 2 + over(s.baby_bond, 60) * 2;
      break;
    case "emotional":
      w += over(s.sickness, 30) * 1.5 + 0.5;
      break;
  }
  return Math.max(0.15, w);
}

/**
 * A feeling that shows on the avatar. Tiredness yawns, tears show — the rest
 * are carried by the RP line alone rather than posing her for no reason.
 * Each one is still subject to her animation preferences.
 */
const MOOD_WORLD: Partial<Record<MoodKey, string>> = {
  sleepy: "yawn",
  tired: "yawn",
  exhausted: "sleep",
  crying: "cry",
  emotional: "cry",
};

/** The fifteen mood swings, expanded into full events. */
export function moodEventDefinitions(): EventDefinition[] {
  return MOOD_KEYS.map((key) => {
    const info = MOOD_CATALOG[key];
    return {
      key: `mood_${key}`,
      category: "mood" as EventCategory,
      title: `${info.emoji} ${info.label}`,
      bodies: [],
      deltas: MOOD_DELTAS[key],
      choices: MOOD_CHOICES[key],
      moodAfter: key,
      world: MOOD_WORLD[key],
      notifyPartner: true,
      weight: (c: EventContext) => moodWeight(key, c),
    };
  });
}

// ---------------------------------------------------------------------------
// The roller
// ---------------------------------------------------------------------------

export interface RolledEvent {
  key: string;
  category: EventCategory;
  title: string;
  body: string;
  deltas: Partial<Record<StatName, number>>;
  choices: EventChoice[];
  moodAfter: MoodKey | null;
  world: string | null;
  notifyPartner: boolean;
}

/**
 * Recency penalty. An event that just fired is nearly impossible to draw again,
 * one from three rolls ago is unlikely, and its whole category is damped too —
 * which is what stops three mood swings in a row.
 */
function recencyFactor(def: EventDefinition, recentKeys: string[]): number {
  const idx = recentKeys.indexOf(def.key);
  let factor = 1;
  // The moment that just happened cannot happen again — a hard zero, not a
  // small weight. "The same event keeps popping up" is the complaint this whole
  // engine exists to answer, and an immediate repeat has no roleplay value even
  // at one-in-a-thousand odds.
  if (idx === 0) return 0;
  if (idx === 1) factor *= 0.1;
  else if (idx === 2) factor *= 0.3;
  else if (idx >= 0 && idx < 6) factor *= 0.6;

  // Category fatigue: same flavour twice in a row is the thing that reads as
  // "it keeps showing me the same event".
  const catOf = (k: string) =>
    k.startsWith("mood_") ? "mood" : (EVENTS_BY_KEY[k]?.category ?? "");
  if (recentKeys[0] && catOf(recentKeys[0]) === def.category) factor *= 0.45;
  if (recentKeys[1] && catOf(recentKeys[1]) === def.category) factor *= 0.75;

  return factor;
}

/** Her current feeling tilts what happens next, the way it does in life. */
function moodAffinity(def: EventDefinition, mood: MoodKey): number {
  if (def.category === "mood") return 1;
  switch (mood) {
    case "anxious":
    case "stressed":
    case "overwhelmed":
      return def.category === "partner" ? 1.6 : def.category === "sweet" ? 0.6 : 1;
    case "lonely":
    case "sad":
      return def.category === "partner" ? 2 : def.category === "sweet" ? 0.7 : 1;
    case "happy":
    case "excited":
      return def.category === "sweet" || def.category === "baby" ? 1.7 : 0.85;
    case "calm":
      return def.category === "sweet" ? 1.4 : 1;
    case "tired":
    case "exhausted":
    case "sleepy":
      return def.category === "body" ? 1.5 : def.category === "nesting" ? 0.4 : 1;
    case "irritated":
    case "frustrated":
      return def.category === "body" ? 1.4 : def.category === "sweet" ? 0.5 : 1;
    case "emotional":
    case "crying":
      return def.category === "sweet" ? 1.5 : def.category === "partner" ? 1.4 : 1;
    default:
      return 1;
  }
}

function resolveChoices(keys: string[]): EventChoice[] {
  const seen = new Set<string>();
  const out: EventChoice[] = [];
  for (const k of keys) {
    const choice = CHOICE_CATALOG[k];
    if (!choice || seen.has(choice.key)) continue;
    seen.add(choice.key);
    out.push(choice);
    if (out.length === 5) break;
  }
  if (!out.length) out.push(CHOICE_CATALOG.sit_with_it);
  return out;
}

/**
 * Draw the next event. Returns null only when every category is switched off.
 */
export function rollEvent(ctx: EventContext, rng: () => number = Math.random): RolledEvent | null {
  const pool = [...EVENT_DEFINITIONS, ...moodEventDefinitions()].filter(
    (def) => !ctx.disabled.has(def.category),
  );

  const scored: { def: EventDefinition; weight: number }[] = [];
  let total = 0;
  for (const def of pool) {
    const base = def.weight(ctx);
    if (base <= 0) continue;
    const w = base * recencyFactor(def, ctx.recentKeys) * moodAffinity(def, ctx.mood);
    if (w <= 0) continue;
    scored.push({ def, weight: w });
    total += w;
  }
  if (!scored.length || total <= 0) return null;

  let roll = rng() * total;
  let picked = scored[scored.length - 1].def;
  for (const entry of scored) {
    roll -= entry.weight;
    if (roll <= 0) {
      picked = entry.def;
      break;
    }
  }

  const body = picked.bodies.length
    ? picked.bodies[Math.floor(rng() * picked.bodies.length)]
    : picked.moodAfter
      ? rpLineFor(picked.moodAfter)
      : "";

  return {
    key: picked.key,
    category: picked.category,
    title: picked.title,
    body,
    deltas: picked.deltas,
    choices: resolveChoices(picked.choices),
    moodAfter: picked.moodAfter ?? null,
    world: picked.world ?? null,
    notifyPartner: Boolean(picked.notifyPartner),
  };
}

/** Choices for an event key, for replaying an event whose row we already have. */
export function choicesForEventKey(key: string): EventChoice[] {
  if (key.startsWith("mood_")) {
    const moodKey = key.slice(5) as MoodKey;
    if (MOOD_CHOICES[moodKey]) return resolveChoices(MOOD_CHOICES[moodKey]);
  }
  const def = EVENTS_BY_KEY[key];
  if (def) return resolveChoices(def.choices);
  return resolveChoices(["rub_belly", "water", "rest", "journal", "ask_partner"]);
}
