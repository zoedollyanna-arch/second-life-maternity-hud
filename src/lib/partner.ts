// Shared Partner HUD catalogue. Pure data — imported by both the browser HUD
// and the server, so a button can never offer something the server will not
// accept, and the server never has to guess what a button meant.

export type PartnerPermission =
  // what the partner may SEE
  | "viewWeek"
  | "viewStage"
  | "viewWellness"
  | "viewSymptoms"
  | "viewMood"
  | "viewKicks"
  | "viewAppointments"
  | "viewMilestones"
  | "viewLabor"
  | "viewJournal"
  // what the partner may DO
  | "allowComfort"
  | "allowPhysical"
  | "allowCare"
  | "allowLaborSupport"
  | "allowHospitalBag";

/** Everything on by default except Mom's private journal. Mom can narrow it. */
export const DEFAULT_PARTNER_PERMISSIONS: Record<PartnerPermission, boolean> = {
  viewWeek: true,
  viewStage: true,
  viewWellness: true,
  viewSymptoms: true,
  viewMood: true,
  viewKicks: true,
  viewAppointments: true,
  viewMilestones: true,
  viewLabor: true,
  viewJournal: false,
  allowComfort: true,
  allowPhysical: true,
  allowCare: true,
  allowLaborSupport: true,
  allowHospitalBag: true,
};

export const PERMISSION_GROUPS: {
  title: string;
  items: { key: PartnerPermission; label: string; hint: string }[];
}[] = [
  {
    title: "Your partner can see",
    items: [
      { key: "viewWeek", label: "Pregnancy week", hint: "Week, day and due date" },
      { key: "viewStage", label: "Stage & baby size", hint: "Trimester and growth" },
      { key: "viewWellness", label: "Your wellbeing", hint: "Energy, rest, hydration" },
      { key: "viewSymptoms", label: "Symptoms", hint: "Nausea, backache, etc." },
      { key: "viewMood", label: "Your mood", hint: "How you're feeling right now" },
      { key: "viewKicks", label: "Baby kicks", hint: "Kick alerts and counts" },
      { key: "viewAppointments", label: "Appointments", hint: "Check-ups and scans" },
      { key: "viewMilestones", label: "Milestones", hint: "The shared moments feed" },
      { key: "viewLabor", label: "Labor & birth", hint: "Contractions and progress" },
      { key: "viewJournal", label: "Journal memories", hint: "Your private entries" },
    ],
  },
  {
    title: "Your partner can do",
    items: [
      { key: "allowComfort", label: "Comfort & encourage", hint: "Kind words, checking in" },
      { key: "allowPhysical", label: "Hug, kiss, feel kicks", hint: "Physical moments" },
      { key: "allowCare", label: "Bring you things", hint: "Ice chips, vitamins, rest" },
      { key: "allowLaborSupport", label: "Labor support", hint: "Hold hand, breathing" },
      { key: "allowHospitalBag", label: "Hospital bag", hint: "Pack items with you" },
    ],
  },
];

/**
 * When may a partner action be used?
 *   any      — whenever they're linked
 *   labor    — only once the engine has started labor
 *   kick     — only while a kick is still fresh
 *   birth    — only during the pushing/birth phase
 *   delivered— only after the baby has arrived
 */
export type PartnerAvailability = "any" | "labor" | "kick" | "birth" | "delivered";

export interface PartnerActionDef {
  /** Action name sent to /api/hud/action — must exist in game.ts. */
  action: string;
  label: string;
  /** Shown on the disabled button so it never silently does nothing. */
  unavailable: string;
  availability: PartnerAvailability;
  permission: PartnerPermission;
  /** Consent-gated actions become a request Mom accepts or declines. */
  consent: boolean;
  /** Short line Mom sees in her request inbox. */
  request?: string;
}

export const PARTNER_ACTIONS: Record<string, PartnerActionDef> = {
  partner_comfort: {
    action: "partner_comfort",
    label: "Comfort",
    unavailable: "Comforting is turned off in her privacy settings.",
    availability: "any",
    permission: "allowComfort",
    consent: false,
  },
  partner_check_on: {
    action: "partner_check_on",
    label: "Check on her",
    unavailable: "Checking in is turned off in her privacy settings.",
    availability: "any",
    permission: "allowComfort",
    consent: false,
  },
  support: {
    action: "support",
    label: "Encourage",
    unavailable: "Encouragement is turned off in her privacy settings.",
    availability: "any",
    permission: "allowComfort",
    consent: false,
  },
  hug: {
    action: "hug",
    label: "Hug",
    unavailable: "Physical moments are turned off in her privacy settings.",
    availability: "any",
    permission: "allowPhysical",
    consent: true,
    request: "wants to hug you",
  },
  kiss: {
    action: "kiss",
    label: "Kiss",
    unavailable: "Physical moments are turned off in her privacy settings.",
    availability: "any",
    permission: "allowPhysical",
    consent: true,
    request: "wants to kiss you",
  },
  feel_baby_kick: {
    action: "feel_baby_kick",
    label: "Feel baby kick",
    unavailable: "Wait for the baby to kick — you'll be told the moment it happens.",
    availability: "kick",
    permission: "viewKicks",
    consent: true,
    request: "wants to feel the baby kick",
  },
  partner_ice_chips: {
    action: "partner_ice_chips",
    label: "Ice chips",
    unavailable: "Ice chips are for labor — no water once contractions start.",
    availability: "labor",
    permission: "allowCare",
    consent: true,
    request: "is offering you ice chips",
  },
  partner_medicine: {
    action: "partner_medicine",
    label: "Vitamins",
    unavailable: "Bringing things is turned off in her privacy settings.",
    availability: "any",
    permission: "allowCare",
    consent: true,
    request: "brought you your prenatal vitamins",
  },
  partner_help_rest: {
    action: "partner_help_rest",
    label: "Help her rest",
    unavailable: "Bringing things is turned off in her privacy settings.",
    availability: "any",
    permission: "allowCare",
    consent: true,
    request: "wants to help you rest",
  },
  partner_water: {
    action: "partner_water",
    label: "Bring water",
    unavailable: "No water during labor — offer ice chips instead.",
    availability: "any",
    permission: "allowCare",
    consent: true,
    request: "brought you a glass of water",
  },
  partner_labor_support: {
    action: "partner_labor_support",
    label: "Hold her hand",
    unavailable: "Available once contractions begin.",
    availability: "labor",
    permission: "allowLaborSupport",
    consent: false,
  },
  partner_breathing: {
    action: "partner_breathing",
    label: "Guide breathing",
    unavailable: "Available once contractions begin.",
    availability: "labor",
    permission: "allowLaborSupport",
    consent: false,
  },
  partner_backrub: {
    action: "partner_backrub",
    label: "Back rub",
    unavailable: "Physical moments are turned off in her privacy settings.",
    availability: "any",
    permission: "allowPhysical",
    consent: true,
    request: "wants to rub your back",
  },
  partner_stay_strong: {
    action: "partner_stay_strong",
    label: "Stay calm",
    unavailable: "Available once contractions begin.",
    availability: "labor",
    permission: "allowLaborSupport",
    consent: false,
  },
  partner_celebrate: {
    action: "partner_celebrate",
    label: "Celebrate",
    unavailable: "Nothing to celebrate just yet.",
    availability: "any",
    permission: "viewMilestones",
    consent: false,
  },
  partner_appointment: {
    action: "partner_appointment",
    label: "Attend",
    unavailable: "No appointment is coming up.",
    availability: "any",
    permission: "viewAppointments",
    consent: false,
  },
  partner_faint: {
    action: "partner_faint",
    label: "Feel faint",
    unavailable: "Only during the birth itself.",
    availability: "birth",
    permission: "allowLaborSupport",
    consent: false,
  },
  partner_vomit_react: {
    action: "partner_vomit_react",
    label: "Get queasy",
    unavailable: "Only during the birth itself.",
    availability: "birth",
    permission: "allowLaborSupport",
    consent: false,
  },
};

// ---------------------------------------------------------------------------
// Shared hospital bag
// ---------------------------------------------------------------------------

export interface BagItemDef {
  key: string;
  label: string;
  group: "Mom" | "Personal" | "Baby";
}

export const HOSPITAL_BAG_ITEMS: BagItemDef[] = [
  { key: "id_insurance", label: "ID & insurance", group: "Mom" },
  { key: "prenatal_records", label: "Prenatal records", group: "Mom" },
  { key: "maternity_pads", label: "Maternity pads", group: "Mom" },
  { key: "comfy_clothes", label: "Comfy clothes", group: "Mom" },
  { key: "going_home_outfit", label: "Going-home outfit", group: "Mom" },
  { key: "underwear", label: "Underwear", group: "Mom" },

  { key: "socks_slippers", label: "Socks & slippers", group: "Personal" },
  { key: "toiletries", label: "Toiletries", group: "Personal" },
  { key: "hair_ties", label: "Hair ties & brush", group: "Personal" },
  { key: "phone_charger", label: "Phone charger", group: "Personal" },
  { key: "snacks_drinks", label: "Snacks & drinks", group: "Personal" },
  { key: "ice_chips_candy", label: "Ice chips & hard candy", group: "Personal" },

  { key: "car_seat", label: "Baby car seat", group: "Baby" },
  { key: "baby_blanket", label: "Blanket", group: "Baby" },
  { key: "baby_outfit", label: "Baby outfit", group: "Baby" },
  { key: "diapers_wipes", label: "Diapers & wipes", group: "Baby" },
  { key: "pacifier", label: "Pacifier", group: "Baby" },
  { key: "baby_essentials", label: "Other essentials", group: "Baby" },
];

export const BAG_ITEM_KEYS = new Set(HOSPITAL_BAG_ITEMS.map((i) => i.key));

// ---------------------------------------------------------------------------
// Optional roleplay reactions during birth
// ---------------------------------------------------------------------------

export type ReactionMode = "manual" | "auto" | "off";
export type ReactionStyle = "stay_strong" | "faint" | "nauseous";

export const REACTION_STYLES: { key: ReactionStyle; label: string; hint: string }[] = [
  { key: "stay_strong", label: "Stay strong", hint: "Steady hands, calm voice, never leaves." },
  { key: "faint", label: "Faint", hint: "The room spins a little. Needs a chair." },
  { key: "nauseous", label: "Queasy", hint: "Looks a bit green, then rallies." },
];

/** How the partner is addressed. Purely cosmetic — the code always says partner. */
export const PARTNER_TITLES = ["Partner", "Dad", "Papa", "Spouse", "Co-Parent"] as const;
export type PartnerTitle = (typeof PARTNER_TITLES)[number];

/** A kick is "fresh" (and so shareable) for this long. */
export const KICK_FRESH_MS = 10 * 60 * 1000;

export const LABOR_PHASE_LABEL: Record<string, string> = {
  none: "Not in labor",
  prelabor: "Early signs",
  early: "Early labor",
  active: "Active labor",
  transition: "Transition",
  pushing: "Pushing",
  delivered: "Delivered",
};
