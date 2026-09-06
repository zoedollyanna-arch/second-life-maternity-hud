// Nestoria wearer preferences.
//
// One schema, shared by the HUD screen and the server. The server never trusts
// the client's shape — `normalizePreferences` is the only way settings enter
// the database, so an old HUD, a replayed request or a hand-crafted POST all
// converge on the same validated object.
//
// Stored in user_settings.settings as a flat JSON blob, merged (`||`) on write,
// so adding a key here is backwards compatible: absent keys fall back to the
// defaults below rather than wiping what she already chose.

import { EVENT_CATEGORIES, type EventCategory } from "./events";

// ---------------------------------------------------------------------------

/** Where an RP event is allowed to interrupt her. */
export type PopupSurface = "both" | "hud" | "world" | "off";

export const POPUP_SURFACES: { key: PopupSurface; label: string; hint: string }[] = [
  {
    key: "both",
    label: "HUD screen + in-world menu",
    hint: "A card on the tablet and a blue menu. Hardest to miss.",
  },
  {
    key: "hud",
    label: "HUD screen only",
    hint: "Nothing pops up over your viewer. Check the tablet when you like.",
  },
  {
    key: "world",
    label: "In-world menu only",
    hint: "The classic blue dialog. Nothing added to the tablet.",
  },
  {
    key: "off",
    label: "Nothing — quiet mode",
    hint: "Events still happen and still log. They just never interrupt.",
  },
];

export const POPUP_FREQUENCIES = [0, 10, 15, 20, 30, 45, 60, 90] as const;

/** In-world flourishes she can individually opt out of. */
export const ANIMATION_KEYS = [
  "vomit",
  "cry",
  "sleep",
  "rest",
  "drink",
  "vitamins",
  "belly_hold",
  "hearts",
  "bathroom",
  "kick",
] as const;

export type AnimationKey = (typeof ANIMATION_KEYS)[number];

export const ANIMATION_LABELS: Record<AnimationKey, string> = {
  vomit: "Vomiting animation & particles",
  cry: "Crying reaction",
  sleep: "Sleeping / resting pose",
  rest: "Sit-and-rest pose",
  drink: "Drinking animation",
  vitamins: "Taking-vitamins animation",
  belly_hold: "Belly-holding pose",
  hearts: "Heart particles",
  bathroom: "Bathroom prop & pose",
  kick: "Baby kick nudge",
};

/** Which event families are allowed to reach the partner HUD. */
export const PARTNER_NOTIFY_KEYS = [
  "mood",
  "sickness",
  "craving",
  "baby",
  "body",
  "labor",
  "milestone",
] as const;

export type PartnerNotifyKey = (typeof PARTNER_NOTIFY_KEYS)[number];

export const PARTNER_NOTIFY_LABELS: Record<PartnerNotifyKey, string> = {
  mood: "Mood swings",
  sickness: "Sickness & nausea",
  craving: "Cravings",
  baby: "Baby movement",
  body: "Aches & Braxton Hicks",
  labor: "Labor & birth",
  milestone: "Milestones",
};

export type PrivacyMode = "private" | "partner" | "partner_doctor" | "public_rp";

export const PRIVACY_MODES: { key: PrivacyMode; label: string; hint: string }[] = [
  { key: "private", label: "Only me", hint: "Nothing leaves your own HUD." },
  { key: "partner", label: "Partner only", hint: "Your partner sees your journey. Nobody else." },
  {
    key: "partner_doctor",
    label: "Partner + midwife",
    hint: "Also visible to an RP midwife or doctor.",
  },
  {
    key: "public_rp",
    label: "Public RP",
    hint: "Nearby roleplayers can see emotes from your HUD.",
  },
];

export type DecayPace = "gentle" | "normal" | "intense";

export const DECAY_PACES: { key: DecayPace; label: string; hint: string; multiplier: number }[] = [
  {
    key: "gentle",
    label: "Gentle",
    hint: "Meters drift slowly. Good for casual play and long sessions.",
    multiplier: 0.55,
  },
  {
    key: "normal",
    label: "Normal",
    hint: "The default pace. Care for yourself a few times a day.",
    multiplier: 1,
  },
  {
    key: "intense",
    label: "Realistic",
    hint: "Meters move fast. Pregnancy is a full-time job.",
    multiplier: 1.6,
  },
];

export const DECAY_MULTIPLIER: Record<DecayPace, number> = {
  gentle: 0.55,
  normal: 1,
  intense: 1.6,
};

// ---------------------------------------------------------------------------

export interface HudPreferences {
  // Events & popups
  popupFrequencyMinutes: number;
  popupSurface: PopupSurface;
  eventCategories: Record<EventCategory, boolean>;
  // Sound & animation
  soundEnabled: boolean;
  soundVolume: number;
  animations: Record<AnimationKey, boolean>;
  // Privacy & partner
  privacyMode: PrivacyMode;
  publicEmotes: boolean;
  partnerNotify: Record<PartnerNotifyKey, boolean>;
  // Realism & pacing
  decayPace: DecayPace;
  allowPica: boolean;
  // Test mode (unlocked with a code, see TEST_MODE_CODE)
  testMode: boolean;
}

const allOn = <T extends string>(keys: readonly T[]): Record<T, boolean> =>
  Object.fromEntries(keys.map((k) => [k, true])) as Record<T, boolean>;

export const DEFAULT_PREFERENCES: HudPreferences = {
  popupFrequencyMinutes: 20,
  popupSurface: "both",
  eventCategories: allOn(EVENT_CATEGORIES),
  soundEnabled: true,
  soundVolume: 70,
  animations: allOn(ANIMATION_KEYS),
  privacyMode: "partner",
  publicEmotes: false,
  partnerNotify: allOn(PARTNER_NOTIFY_KEYS),
  decayPace: "normal",
  allowPica: true,
  testMode: false,
};

const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);

function boolMap<T extends string>(
  raw: unknown,
  keys: readonly T[],
  fallback: Record<T, boolean>,
): Record<T, boolean> {
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return Object.fromEntries(keys.map((k) => [k, bool(source[k], fallback[k])])) as Record<
    T,
    boolean
  >;
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

/**
 * Coerce anything into a valid preference object. Used on read (so a row
 * written by an older build still renders) and on write (so nothing invalid is
 * ever stored). `base` is the currently-stored value, which lets a partial
 * patch from one Settings tab leave the other tabs alone.
 */
export function normalizePreferences(
  raw: unknown,
  base: HudPreferences = DEFAULT_PREFERENCES,
): HudPreferences {
  const s = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

  const freqRaw = Number(s.popupFrequencyMinutes);
  const popupFrequencyMinutes = Number.isFinite(freqRaw)
    ? Math.max(0, Math.min(240, Math.round(freqRaw)))
    : base.popupFrequencyMinutes;

  const volRaw = Number(s.soundVolume);
  const soundVolume = Number.isFinite(volRaw)
    ? Math.max(0, Math.min(100, Math.round(volRaw)))
    : base.soundVolume;

  return {
    popupFrequencyMinutes,
    popupSurface: oneOf(
      s.popupSurface,
      POPUP_SURFACES.map((p) => p.key),
      base.popupSurface,
    ),
    eventCategories: boolMap(s.eventCategories, EVENT_CATEGORIES, base.eventCategories),
    soundEnabled: bool(s.soundEnabled, base.soundEnabled),
    soundVolume,
    animations: boolMap(s.animations, ANIMATION_KEYS, base.animations),
    privacyMode: oneOf(
      s.privacyMode,
      PRIVACY_MODES.map((p) => p.key),
      base.privacyMode,
    ),
    publicEmotes: bool(s.publicEmotes, base.publicEmotes),
    partnerNotify: boolMap(s.partnerNotify, PARTNER_NOTIFY_KEYS, base.partnerNotify),
    decayPace: oneOf(s.decayPace, ["gentle", "normal", "intense"] as const, base.decayPace),
    allowPica: bool(s.allowPica, base.allowPica),
    testMode: bool(s.testMode, base.testMode),
  };
}

/** Categories switched off, as the roller wants them. */
export function disabledCategories(prefs: HudPreferences): Set<EventCategory> {
  return new Set(EVENT_CATEGORIES.filter((c) => !prefs.eventCategories[c]));
}

/**
 * The code that reveals the test panel. Kept deliberately unguessable-by-accident
 * but not a secret: it exists so a real player never trips over labor controls,
 * not to defend anything. Override with HUD_TEST_CODE on the server.
 */
export const TEST_MODE_CODE = "nestoria-test";

export interface TestModeState {
  unlocked: boolean;
  /** 1 = real time. Higher = labor runs faster. */
  laborSpeed: number;
}

export const TEST_LABOR_SPEEDS = [1, 5, 10, 25, 60] as const;
