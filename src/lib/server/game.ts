// Server-side domain logic for the Nestoria pregnancy HUD.
// Everything here runs inside API route handlers only.

import { db, apiSecret, appUrl } from "./db";
import {
  computeProgress,
  milestoneForWeek,
  heartbeatForWeek,
  severityLabel,
  DEFAULT_SYMPTOMS,
} from "../pregnancy";

export interface HudUser {
  id: string;
  avatar_key: string;
  avatar_name: string;
  display_name: string | null;
  role: "mom" | "partner";
}

type StatName =
  | "energy"
  | "hydration"
  | "hunger"
  | "bladder"
  | "mood"
  | "immunity"
  | "sickness"
  | "rest"
  | "vitamins"
  | "comfort"
  | "nutrition"
  | "stress"
  | "baby_wellness"
  | "baby_bond"
  | "baby_movement";

const STAT_NAMES: StatName[] = [
  "energy",
  "hydration",
  "hunger",
  "bladder",
  "mood",
  "immunity",
  "sickness",
  "rest",
  "vitamins",
  "comfort",
  "nutrition",
  "stress",
  "baby_wellness",
  "baby_bond",
  "baby_movement",
];

// Per-hour drift. Sickness rises (worse) early on; everything else drains.
const DECAY_PER_HOUR: Record<StatName, number> = {
  energy: -2.2,
  hydration: -3.5,
  hunger: -3,
  bladder: -4,
  mood: -0.9,
  immunity: -0.35,
  sickness: 0.7,
  rest: -2.2,
  vitamins: -1.4,
  comfort: -1.5,
  nutrition: -1,
  stress: 0.55,
  baby_wellness: -0.08,
  baby_bond: -0.12,
  baby_movement: -0.25,
};

const clamp = (v: number) => Math.max(0, Math.min(100, v));

type FoodItem = {
  key: string;
  name: string;
  category: string;
  cravingTags: string[];
  deltas: Partial<Record<StatName, number>>;
  cravingRelief: number;
  note: string;
};

const FOOD_ITEMS: FoodItem[] = [
  {
    key: "ham_sub",
    name: "Ham sub",
    category: "salty",
    cravingTags: ["ham sub", "sub", "sandwich", "salty", "protein"],
    deltas: { hunger: 24, mood: 5, nutrition: 6, hydration: -2, baby_wellness: 1 },
    cravingRelief: 24,
    note: "A filling salty sandwich with a little protein.",
  },
  {
    key: "spaghetti",
    name: "Spaghetti",
    category: "grains",
    cravingTags: ["spaghetti", "pasta", "tomato", "grains"],
    deltas: { hunger: 26, mood: 7, nutrition: 7, energy: 4, baby_wellness: 2 },
    cravingRelief: 26,
    note: "A warm pasta meal that settles hunger well.",
  },
  {
    key: "chicken_bacon_burger",
    name: "Chicken bacon burger",
    category: "protein",
    cravingTags: ["chicken bacon burger", "chicken", "bacon", "burger", "salty", "protein"],
    deltas: { hunger: 30, mood: 9, nutrition: 4, hydration: -3, sickness: 1, baby_wellness: 1 },
    cravingRelief: 30,
    note: "Big comfort food: great for hunger, heavier on the body.",
  },
  {
    key: "lasagna",
    name: "Lasagna",
    category: "dairy",
    cravingTags: ["lasagna", "pasta", "cheese", "dairy", "comfort"],
    deltas: { hunger: 32, mood: 8, nutrition: 8, energy: 3, sickness: 1, baby_wellness: 2 },
    cravingRelief: 28,
    note: "A hearty comfort meal with decent nutrition.",
  },
  {
    key: "jam_toast",
    name: "Jam toast",
    category: "sweet",
    cravingTags: ["jam toast", "toast", "jam", "sweet"],
    deltas: { hunger: 12, mood: 8, nutrition: 1, energy: 3, sickness: -2 },
    cravingRelief: 18,
    note: "A light sweet snack that can help queasiness.",
  },
  {
    key: "cheeseburger",
    name: "Cheeseburger",
    category: "salty",
    cravingTags: ["cheeseburger", "burger", "cheese", "salty"],
    deltas: { hunger: 30, mood: 10, nutrition: 3, hydration: -3, sickness: 2 },
    cravingRelief: 30,
    note: "Strong craving relief, but not an everyday nutrition boost.",
  },
  {
    key: "french_toast",
    name: "French toast",
    category: "sweet",
    cravingTags: ["french toast", "toast", "sweet", "breakfast"],
    deltas: { hunger: 18, mood: 10, nutrition: 2, energy: 4 },
    cravingRelief: 24,
    note: "A cozy sweet breakfast craving.",
  },
  {
    key: "pickle_chips",
    name: "Pickle chips",
    category: "salty",
    cravingTags: ["pickle chips", "pickle", "pickles", "chips", "salty", "sour", "crunchy"],
    deltas: { hunger: 10, mood: 7, hydration: -4, sickness: -2 },
    cravingRelief: 26,
    note: "Salty, sour and crunchy - the classic pregnancy craving.",
  },
  {
    key: "chocolate_bar",
    name: "Chocolate bar",
    category: "sweet",
    cravingTags: ["chocolate bar", "chocolate", "candy", "cocoa", "sweet"],
    deltas: { hunger: 8, mood: 12, energy: 5, nutrition: -1, sickness: 1 },
    cravingRelief: 28,
    note: "Pure comfort - a little mood magic in a wrapper.",
  },
];

function foodByKey(key: string): FoodItem | undefined {
  return FOOD_ITEMS.find((food) => food.key === key);
}

function foodForCraving(craving: string): FoodItem {
  const normalized = craving.toLowerCase();
  return (
    FOOD_ITEMS.find((food) => food.cravingTags.some((tag) => normalized.includes(tag))) ??
    FOOD_ITEMS[Math.floor(Math.random() * FOOD_ITEMS.length)]
  );
}

function foodSummary(food: FoodItem): Record<string, unknown> {
  return {
    key: food.key,
    name: food.name,
    category: food.category,
    cravingRelief: food.cravingRelief,
    note: food.note,
    deltas: food.deltas,
  };
}

function partnerCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}

// ---------------------------------------------------------------------------
// Users / sessions
// ---------------------------------------------------------------------------

export async function getOrCreateUser(
  avatarKey: string,
  avatarName: string,
  role: "mom" | "partner",
): Promise<HudUser> {
  const { rows } = await db().query(
    `insert into hud_users (avatar_key, avatar_name, role)
     values ($1, $2, $3)
     on conflict (avatar_key) do update
       set avatar_name = excluded.avatar_name,
           role = excluded.role,
           updated_at = now()
     returning id, avatar_key, avatar_name, display_name, role`,
    [avatarKey, avatarName, role],
  );
  const user = rows[0] as HudUser;
  await db().query(`insert into user_stats (user_id) values ($1) on conflict do nothing`, [
    user.id,
  ]);
  await db().query(
    `insert into user_settings (user_id, settings)
     values ($1, jsonb_build_object(
       'popupFrequencyMinutes', 20,
       'setupComplete', false,
       'partnerPermissions', jsonb_build_object(
         'babyUpdates', true,
         'momWellness', false,
         'cravings', true,
         'appointments', true,
         'journalMemories', false
       )
     ))
     on conflict do nothing`,
    [user.id],
  );
  return user;
}

export async function createSession(userId: string): Promise<string> {
  // opportunistic housekeeping: drop this user's expired sessions
  await db().query(`delete from hud_sessions where user_id = $1 and expires_at < now()`, [userId]);
  const { rows } = await db().query(
    `insert into hud_sessions (user_id) values ($1) returning token`,
    [userId],
  );
  return rows[0].token as string;
}

export async function resolveSession(token: string | null): Promise<HudUser | null> {
  if (!token || !/^[0-9a-f-]{36}$/i.test(token)) return null;
  const { rows } = await db().query(
    `update hud_sessions
     set expires_at = now() + interval '90 days'
     where token = $1 and expires_at > now()
     returning user_id`,
    [token],
  );
  if (!rows[0]) return null;
  const { rows: userRows } = await db().query(
    `select id, avatar_key, avatar_name, display_name, role
     from hud_users where id = $1`,
    [rows[0].user_id],
  );
  return (userRows[0] as HudUser) ?? null;
}

export async function upsertDevice(
  userId: string,
  kind: "hud" | "belly" | "partner",
  objectKey: string,
  callbackUrl: string | null,
  region: string | null,
) {
  await db().query(
    `insert into sl_devices (user_id, kind, object_key, callback_url, region, last_seen)
     values ($1, $2, $3, $4, $5, now())
     on conflict (user_id, kind) do update
       set object_key = excluded.object_key,
           callback_url = excluded.callback_url,
           region = excluded.region,
           last_seen = now()`,
    [userId, kind, objectKey, callbackUrl, region],
  );
}

// ---------------------------------------------------------------------------
// Pregnancy
// ---------------------------------------------------------------------------

export async function ensureActivePregnancy(userId: string) {
  const existing = await db().query(
    `select * from pregnancies where user_id = $1 and status = 'active' limit 1`,
    [userId],
  );
  if (existing.rows[0]) return existing.rows[0];
  const created = await db().query(
    `insert into pregnancies (user_id, partner_code) values ($1, $2) returning *`,
    [userId, partnerCode()],
  );
  const preg = created.rows[0];
  for (const name of DEFAULT_SYMPTOMS) {
    await db().query(
      `insert into symptoms (pregnancy_id, name, severity) values ($1, $2, $3)
       on conflict (pregnancy_id, name) do nothing`,
      [preg.id, name, Math.floor(Math.random() * 30)],
    );
  }
  await addNotification(
    userId,
    "Welcome to Nestoria ♥",
    "Your pregnancy journey has begun. Wear your HUD and belly, and share your pairing code with your partner.",
  );
  return preg;
}

/** For partners: find the pregnancy (and mom) they're linked to. */
export async function pregnancyForUser(user: HudUser) {
  if (user.role === "partner") {
    const { rows } = await db().query(
      `select p.*, u.avatar_key as mom_avatar_key, u.avatar_name as mom_avatar_name,
              u.id as mom_user_id
       from pregnancies p join hud_users u on u.id = p.user_id
       where p.partner_user_id = $1 and p.status = 'active' limit 1`,
      [user.id],
    );
    return rows[0] ?? null;
  }
  const preg = await ensureActivePregnancy(user.id);
  return {
    ...preg,
    mom_avatar_key: user.avatar_key,
    mom_avatar_name: user.avatar_name,
    mom_user_id: user.id,
  };
}

// ---------------------------------------------------------------------------
// Stats with lazy decay
// ---------------------------------------------------------------------------

export async function getStatsWithDecay(userId: string, trimester: number) {
  const { rows } = await db().query(`select * from user_stats where user_id = $1`, [userId]);
  let stats = rows[0];
  if (!stats) {
    const created = await db().query(
      `insert into user_stats (user_id) values ($1)
       on conflict (user_id) do update set updated_at = user_stats.updated_at
       returning *`,
      [userId],
    );
    stats = created.rows[0];
  }
  const hours = (Date.now() - new Date(stats.updated_at).getTime()) / 3_600_000;
  if (hours < 0.05) return normalizeStats(stats);

  const updated = decayStats(stats, trimester, hours);
  const { rows: saved } = await db().query(
    `update user_stats set
       energy=$2, hydration=$3, hunger=$4, bladder=$5, mood=$6,
       immunity=$7, sickness=$8, rest=$9, vitamins=$10, comfort=$11,
       nutrition=$12, stress=$13, baby_wellness=$14, baby_bond=$15, baby_movement=$16,
       updated_at = now()
     where user_id = $1 returning *`,
    [
      userId,
      updated.energy,
      updated.hydration,
      updated.hunger,
      updated.bladder,
      updated.mood,
      updated.immunity,
      updated.sickness,
      updated.rest,
      updated.vitamins,
      updated.comfort,
      updated.nutrition,
      updated.stress,
      updated.baby_wellness,
      updated.baby_bond,
      updated.baby_movement,
    ],
  );
  return normalizeStats(saved[0]);
}

function normalizeStats(row: Record<string, unknown>) {
  const out: Record<StatName, number> = {} as Record<StatName, number>;
  for (const name of STAT_NAMES) out[name] = Math.round(Number(row[name]));
  return out;
}

function decayStats(row: Record<string, unknown>, trimester: number, hours: number) {
  const base = normalizeStats(row);
  const updated: Record<StatName, number> = {} as Record<StatName, number>;
  const activeHours = smartDecayHours(hours);
  for (const name of STAT_NAMES) {
    let rate = DECAY_PER_HOUR[name];
    if (name === "sickness") rate = trimester === 1 ? 1.1 : -1.2;
    if (name === "immunity" && Number(base.vitamins) < 20) rate = -2;
    if (rate < 0 && Number(base[name]) < 25) rate *= 0.45;
    if (rate > 0 && Number(base[name]) > 75) rate *= 0.45;
    updated[name] = clamp(Number(base[name]) + rate * activeHours);
  }
  return updated;
}

function smartDecayHours(hours: number) {
  const safeHours = Math.max(0, hours);
  if (safeHours <= 8) return safeHours;
  const dampedOffline = Math.sqrt(safeHours - 8) * 0.75;
  return Math.min(18, 8 + dampedOffline);
}

async function bumpStats(userId: string, deltas: Partial<Record<StatName, number>>) {
  const sets: string[] = [];
  const values: unknown[] = [userId];
  let i = 2;
  for (const [name, delta] of Object.entries(deltas)) {
    sets.push(`${name} = greatest(0, least(100, ${name} + $${i}))`);
    values.push(delta);
    i++;
  }
  if (!sets.length) return;
  await db().query(
    `update user_stats set ${sets.join(", ")}, updated_at = now() where user_id = $1`,
    values,
  );
}

async function logWellness(
  userId: string,
  pregnancyId: string,
  action: string,
  deltas: Partial<Record<StatName, number>>,
  note?: string,
) {
  await db().query(
    `insert into wellness_logs (user_id, pregnancy_id, action, deltas, note)
     values ($1, $2, $3, $4, $5)`,
    [userId, pregnancyId, action, JSON.stringify(deltas), note ?? null],
  );
}

async function applyCare(
  userId: string,
  pregnancyId: string,
  action: string,
  deltas: Partial<Record<StatName, number>>,
  note?: string,
) {
  await bumpStats(userId, deltas);
  await logWellness(userId, pregnancyId, action, deltas, note);
}

async function getActiveCraving(pregnancyId: string) {
  const { rows } = await db().query(
    `select id, craving, category, intensity, relief, sweets_streak, updated_at
     from cravings
     where pregnancy_id = $1 and active = true
     order by updated_at desc
     limit 1`,
    [pregnancyId],
  );
  return rows[0] as
    | {
        id: string;
        craving: string;
        category: string;
        intensity: number;
        relief: number;
        sweets_streak: number;
        updated_at: string;
      }
    | undefined;
}

async function ensureCraving(pregnancyId: string, trimester: number) {
  const existing = await getActiveCraving(pregnancyId);
  if (existing) return existing;
  const trimesterFoods =
    trimester === 1
      ? ["jam_toast", "french_toast", "spaghetti", "pickle_chips"]
      : trimester === 2
        ? ["cheeseburger", "lasagna", "ham_sub", "french_toast", "pickle_chips", "chocolate_bar"]
        : ["chicken_bacon_burger", "lasagna", "spaghetti", "cheeseburger", "chocolate_bar"];
  const food =
    foodByKey(trimesterFoods[Math.floor(Math.random() * trimesterFoods.length)]) ?? FOOD_ITEMS[0];
  const { rows } = await db().query(
    `insert into cravings (pregnancy_id, craving, category, intensity)
     values ($1, $2, $3, $4)
     returning id, craving, category, intensity, relief, sweets_streak, updated_at`,
    [pregnancyId, food.name, food.category, 45 + Math.floor(Math.random() * 36)],
  );
  return rows[0];
}

// ---------------------------------------------------------------------------
// Ultrasound scrapbook — photos unlock as the pregnancy reaches each scan week
// ---------------------------------------------------------------------------

// photo_index 1..10 → the week each scan becomes available
export const ULTRASOUND_WEEKS = [6, 9, 12, 16, 20, 24, 28, 32, 36, 39];

async function ensureUltrasoundUnlocks(pregnancyId: string, momId: string, week: number) {
  const due = ULTRASOUND_WEEKS.map((w, i) => ({ index: i + 1, week: w })).filter(
    (u) => u.week <= week,
  );
  let announcedUltrasoundBatch = false;
  for (const u of due) {
    const inserted = await db().query(
      `insert into ultrasounds (pregnancy_id, photo_index, week)
       values ($1, $2, $3) on conflict (pregnancy_id, photo_index) do nothing
       returning id`,
      [pregnancyId, u.index, u.week],
    );
    if (inserted.rowCount) {
      await addNotification(
        momId,
        "You have a new ultrasound 📸",
        `Your week ${u.week} scan is ready — open the scrapbook to see your little one ♥`,
      );
      if (!announcedUltrasoundBatch) {
        announcedUltrasoundBatch = true;
        await queueCommand(momId, "hud", "say", {
          text: "[Ultrasound] New photo(s) are waiting on your dashboard.",
        });
      }
    }
  }
  const { rows } = await db().query(
    `select photo_index, week, seen, unlocked_at from ultrasounds
     where pregnancy_id = $1 order by photo_index`,
    [pregnancyId],
  );
  return rows.map((r) => ({
    index: r.photo_index as number,
    week: r.week as number,
    seen: r.seen as boolean,
    unlockedAt: r.unlocked_at as string,
    url: `/ultrasounds/ultrasound-${String(r.photo_index).padStart(2, "0")}.jpg`,
  }));
}

async function recordEvent(
  pregnancyId: string,
  userId: string,
  eventType: string,
  title: string,
  body: string,
  choice?: string,
) {
  await db().query(
    `insert into event_history (pregnancy_id, user_id, event_type, title, body, choice)
     values ($1, $2, $3, $4, $5, $6)`,
    [pregnancyId, userId, eventType, title, body, choice ?? null],
  );
}

// ---------------------------------------------------------------------------
// Notifications / journal / partner feed
// ---------------------------------------------------------------------------

export async function addNotification(userId: string, title: string, body?: string) {
  await db().query(`insert into notifications (user_id, title, body) values ($1, $2, $3)`, [
    userId,
    title,
    body ?? null,
  ]);
}

async function addJournal(
  userId: string,
  title: string,
  body: string | null,
  kind: "note" | "milestone" | "memory" | "appointment",
  completed = true,
) {
  await db().query(
    `insert into journal_entries (user_id, title, body, kind, completed)
     values ($1, $2, $3, $4, $5)`,
    [userId, title, body, kind, completed],
  );
}

async function addPartnerActivity(
  pregnancyId: string,
  actorName: string,
  activity: string,
  pts = 5,
) {
  await db().query(
    `insert into partner_activities (pregnancy_id, actor_name, activity, support_pts)
     values ($1, $2, $3, $4)`,
    [pregnancyId, actorName, activity, pts],
  );
}

// ---------------------------------------------------------------------------
// SL command queue + push
// ---------------------------------------------------------------------------

export async function queueCommand(
  userId: string,
  deviceKind: "hud" | "belly" | "partner",
  command: string,
  params: Record<string, unknown> = {},
) {
  await db().query(
    `insert into sl_commands (user_id, device_kind, command, params)
     values ($1, $2, $3, $4)`,
    [userId, deviceKind, command, JSON.stringify(params)],
  );
  // best-effort push to the in-world object; polling is the fallback
  void pushPending(userId, deviceKind).catch(() => {});
}

export async function takePendingCommands(userId: string, kind: string) {
  // housekeeping: drop delivered commands and stale pending ones (a device
  // that was offline for a day shouldn't replay a burst of old effects)
  await db().query(
    `delete from sl_commands
     where user_id = $1
       and ((status = 'sent' and sent_at < now() - interval '2 days')
         or (status = 'pending' and created_at < now() - interval '1 day'))`,
    [userId],
  );
  const { rows } = await db().query(
    `update sl_commands set status = 'sent', sent_at = now()
     where id in (
       select id from sl_commands
       where user_id = $1 and device_kind = $2 and status = 'pending'
       order by created_at limit 10
     )
     returning command, params`,
    [userId, kind],
  );
  return rows as { command: string; params: Record<string, unknown> }[];
}

async function pushPending(userId: string, kind: "hud" | "belly" | "partner") {
  const { rows } = await db().query(
    `select callback_url from sl_devices where user_id = $1 and kind = $2`,
    [userId, kind],
  );
  const url = rows[0]?.callback_url as string | undefined;
  if (!url) return;
  const commands = await takePendingCommands(userId, kind);
  if (!commands.length) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ secret: apiSecret(), commands }),
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    // object offline/URL dead — requeue so the next poll picks them up
    await db().query(
      `update sl_commands set status = 'pending', sent_at = null
       where user_id = $1 and device_kind = $2 and status = 'sent'
         and sent_at > now() - interval '30 seconds'`,
      [userId, kind],
    );
  }
}

// ---------------------------------------------------------------------------
// Dashboard state
// ---------------------------------------------------------------------------

export async function getDashboardState(user: HudUser) {
  const preg = await pregnancyForUser(user);
  if (!preg) return { error: "no_pregnancy" };

  const momId: string = preg.mom_user_id;
  const progress = computeProgress(new Date(preg.conceived_at), preg.duration_days);
  const milestone = milestoneForWeek(progress.week);
  const stats = await getStatsWithDecay(momId, progress.trimester);

  const [
    symptoms,
    journal,
    activities,
    notifications,
    kicks,
    settings,
    supportRow,
    craving,
    events,
  ] = await Promise.all([
    db().query(`select name, severity from symptoms where pregnancy_id = $1 order by name`, [
      preg.id,
    ]),
    db().query(
      `select id, title, body, kind, completed, entry_date, created_at
         from journal_entries where user_id = $1 order by created_at desc limit 12`,
      [momId],
    ),
    db().query(
      `select actor_name, activity, created_at from partner_activities
         where pregnancy_id = $1 order by created_at desc limit 6`,
      [preg.id],
    ),
    db().query(
      `select id, title, body, read, created_at from notifications
         where user_id = $1 order by created_at desc limit 15`,
      [user.id],
    ),
    db().query(
      `select count(*)::int as n from kick_events
         where pregnancy_id = $1 and created_at > now() - interval '24 hours'`,
      [preg.id],
    ),
    db().query(`select settings from user_settings where user_id = $1`, [user.id]),
    db().query(
      `select coalesce(sum(support_pts), 0)::int as pts from partner_activities
         where pregnancy_id = $1 and created_at > now() - interval '7 days'`,
      [preg.id],
    ),
    getActiveCraving(preg.id),
    db().query(
      `select event_type, title, body, choice, created_at
         from event_history where pregnancy_id = $1 order by created_at desc limit 5`,
      [preg.id],
    ),
  ]);

  const wellness = Math.round(
    (stats.energy +
      stats.hydration +
      stats.hunger +
      stats.mood +
      stats.immunity +
      stats.nutrition +
      (100 - stats.sickness) +
      (100 - stats.stress)) /
      8,
  );
  const popupFrequencyMinutes = Number(settings.rows[0]?.settings?.popupFrequencyMinutes ?? 20);
  const ultrasounds = await ensureUltrasoundUnlocks(preg.id, momId, progress.week);

  return {
    user: {
      name: user.display_name ?? user.avatar_name,
      avatarKey: user.avatar_key,
      role: user.role,
    },
    pregnancy: {
      id: preg.id,
      status: preg.status,
      week: progress.week,
      day: progress.day,
      trimester: progress.trimester,
      progressPct: progress.progressPct,
      dueDate: progress.dueDate.toISOString(),
      daysToGo: progress.daysToGo,
      delivered: progress.delivered,
      babyName: preg.baby_name,
      babyGender: preg.baby_gender,
      durationDays: preg.duration_days,
      setupComplete: Boolean(preg.setup_complete || settings.rows[0]?.settings?.setupComplete),
      setupStep: Number(preg.setup_step ?? 1),
      progressionMode: preg.progression_mode ?? "scaled",
      babyCount: Number(preg.baby_count ?? 1),
      babyNames: Array.isArray(preg.baby_names) ? preg.baby_names : [],
      privacyMode: preg.privacy_mode ?? "partner",
      baby: {
        size: milestone.size,
        lengthCm: milestone.lengthCm,
        weightG: milestone.weightG,
        note: milestone.note,
        heartbeat: heartbeatForWeek(progress.week),
        kicksToday: kicks.rows[0].n as number,
        position: progress.week >= 34 ? "Head Down" : "Still turning",
        movement:
          progress.week < 16
            ? "Too small to feel"
            : stats.baby_movement > 75
              ? "Very Active"
              : (kicks.rows[0].n as number) > 8
                ? "Very Active"
                : (kicks.rows[0].n as number) > 3
                  ? "Active"
                  : "Calm",
        wellness: stats.baby_wellness,
        bond: stats.baby_bond,
        movementScore: stats.baby_movement,
      },
    },
    stats,
    wellness,
    symptoms: symptoms.rows.map((s) => ({
      name: s.name,
      severity: s.severity,
      label: severityLabel(s.severity),
    })),
    journal: journal.rows,
    partner: {
      name: preg.partner_name,
      linked: !!preg.partner_user_id,
      code: preg.partner_code,
      support: Math.min(100, 20 + (supportRow.rows[0].pts as number)),
      activities: activities.rows,
    },
    notifications: notifications.rows,
    unread: notifications.rows.filter((n) => !n.read).length,
    currentCraving: craving ?? null,
    ultrasounds,
    newUltrasounds: ultrasounds.filter((u) => !u.seen).length,
    foods: FOOD_ITEMS.map(foodSummary),
    recentEvents: events.rows,
    popupFrequencyMinutes,
    nextEventAt:
      popupFrequencyMinutes > 0
        ? new Date(Date.now() + popupFrequencyMinutes * 60_000).toISOString()
        : null,
    settings: settings.rows[0]?.settings ?? {},
    serverTime: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Action engine — every button (web or in-world) goes through here
// ---------------------------------------------------------------------------

export interface ActionResult {
  ok: boolean;
  message: string;
  [key: string]: unknown;
}

export async function performAction(
  user: HudUser,
  action: string,
  params: Record<string, unknown>,
  source: "web" | "sl",
): Promise<ActionResult> {
  const preg = await pregnancyForUser(user);
  if (!preg) return { ok: false, message: "No active pregnancy linked to this HUD." };
  const momId: string = preg.mom_user_id;
  const momName: string = preg.mom_avatar_name;
  const actorName = user.display_name ?? user.avatar_name;
  const isPartner = user.role === "partner";

  await db().query(
    `insert into action_log (user_id, action, source, payload) values ($1, $2, $3, $4)`,
    [user.id, action, source, JSON.stringify(params)],
  );

  const str = (k: string, max = 500) =>
    typeof params[k] === "string" ? (params[k] as string).slice(0, max).trim() : "";
  const actionProgress = computeProgress(new Date(preg.conceived_at), preg.duration_days);
  const stats = await getStatsWithDecay(momId, actionProgress.trimester);

  switch (action) {
    // ---- setup / pregnancy controls ---------------------------------------
    case "setup_update": {
      const displayName = str("momName", 80);
      const week = Math.max(1, Math.min(42, Math.round(Number(params.week ?? 1))));
      const day = Math.max(0, Math.min(6, Math.round(Number(params.day ?? 0))));
      const babyCount = Math.max(1, Math.min(3, Math.round(Number(params.babyCount ?? 1))));
      const babyGender = str("babyGender", 20);
      const babyNames = Array.isArray(params.babyNames)
        ? params.babyNames
            .filter((n) => typeof n === "string")
            .map((n) => n.slice(0, 60).trim())
            .filter(Boolean)
        : [];
      const privacyMode = str("privacyMode", 20) || "partner";
      const popupFrequency = Math.max(
        0,
        Math.min(240, Math.round(Number(params.popupFrequencyMinutes ?? 20))),
      );
      // "week 24" means 24 completed weeks, matching the dashboard display
      const elapsedDays = Math.max(0, Math.min(279, week * 7 + day));
      const conceivedAt = new Date(
        Date.now() - (elapsedDays / 280) * Number(preg.duration_days) * 86_400_000,
      );

      if (displayName) {
        await db().query(
          `update hud_users set display_name = $2, updated_at = now() where id = $1`,
          [momId, displayName],
        );
      }
      await db().query(
        `update pregnancies set
           conceived_at = $2, pregnancy_day = $3, baby_count = $4,
           baby_gender = $5, baby_name = $6, baby_names = $7,
           privacy_mode = $8, setup_complete = true, setup_step = 10,
           updated_at = now()
         where id = $1`,
        [
          preg.id,
          conceivedAt.toISOString(),
          day,
          babyCount,
          ["girl", "boy", "twins", "surprise"].includes(babyGender) ? babyGender : "surprise",
          babyNames[0] ?? null,
          JSON.stringify(babyNames),
          ["private", "partner", "partner_doctor", "public_rp"].includes(privacyMode)
            ? privacyMode
            : "partner",
        ],
      );
      await db().query(
        `insert into user_settings (user_id, settings) values ($1, $2)
         on conflict (user_id) do update set settings = user_settings.settings || excluded.settings`,
        [momId, JSON.stringify({ setupComplete: true, popupFrequencyMinutes: popupFrequency })],
      );
      await addJournal(
        momId,
        "Nestoria journey started",
        `Week ${week}+${day}. Popup events every ${popupFrequency || "manual"} minutes.`,
        "milestone",
      );
      await addNotification(
        momId,
        "Your Nestoria journey has begun",
        "Every day is a step closer to meeting your little one.",
      );
      await queueCommand(momId, "hud", "chime", {});
      return { ok: true, message: "Profile saved. Your Nestoria journey has begun." };
    }

    case "update_week": {
      const week = Math.max(0, Math.min(42, Math.round(Number(params.week ?? 1))));
      const day = Math.max(0, Math.min(6, Math.round(Number(params.day ?? 0))));
      const elapsedDays = Math.max(0, Math.min(279, week * 7 + day));
      const conceivedAt = new Date(
        Date.now() - (elapsedDays / 280) * Number(preg.duration_days) * 86_400_000,
      );
      await db().query(
        `update pregnancies set conceived_at = $2, pregnancy_day = $3,
          progression_mode = 'manual', updated_at = now() where id = $1`,
        [preg.id, conceivedAt.toISOString(), day],
      );
      await addJournal(momId, "Pregnancy week updated", `Updated to week ${week}+${day}.`, "note");
      return { ok: true, message: `Pregnancy updated to week ${week}+${day}.` };
    }

    case "set_due_date": {
      const due = str("dueDate", 40);
      const dueDate = new Date(due);
      if (Number.isNaN(dueDate.getTime())) return { ok: false, message: "Enter a valid due date." };
      const conceivedAt = new Date(dueDate.getTime() - Number(preg.duration_days) * 86_400_000);
      await db().query(
        `update pregnancies set conceived_at = $2, updated_at = now() where id = $1`,
        [preg.id, conceivedAt.toISOString()],
      );
      return { ok: true, message: "Due date saved." };
    }

    // ---- daily snapshot / baby moments ------------------------------------
    case "daily_checkin":
      await applyCare(
        momId,
        preg.id,
        action,
        { mood: 4, stress: -3, baby_bond: 2 },
        "Daily check-in",
      );
      await addJournal(
        momId,
        "Daily check-in",
        `${actorName} takes a quiet moment to check in with her body and baby.`,
        "note",
      );
      await queueCommand(momId, "hud", "say", {
        text: `${actorName} takes a quiet moment to check in with her body and baby.`,
      });
      return { ok: true, message: "Daily check-in saved. Mood lifted." };

    case "hold_belly":
      await applyCare(momId, preg.id, action, { mood: 5, comfort: 6, baby_bond: 5 }, "Held belly");
      await queueCommand(momId, "hud", "belly_hold", {});
      await queueCommand(momId, "hud", "say", {
        text: `${actorName} rests both hands over her belly.`,
      });
      return { ok: true, message: "Belly-holding moment started." };

    case "heartbeat": {
      const progress = computeProgress(new Date(preg.conceived_at), preg.duration_days);
      const bpm = heartbeatForWeek(progress.week);
      await applyCare(momId, preg.id, action, { mood: 5, baby_bond: 4 }, "Heartbeat check");
      await queueCommand(momId, "hud", bpm > 0 ? "heartbeat" : "say", {
        text: bpm > 0 ? `Baby heartbeat: ${bpm} bpm.` : "Too early for a heartbeat moment.",
      });
      return {
        ok: true,
        message:
          bpm > 0 ? `Heartbeat checked: ${bpm} bpm.` : "Too early to hear the heartbeat yet.",
      };
    }

    case "talk_to_baby":
      await applyCare(
        momId,
        preg.id,
        action,
        { mood: 5, baby_bond: 8, baby_movement: 6 },
        "Talked to baby",
      );
      await queueCommand(momId, "hud", "belly_hold", {});
      await queueCommand(momId, "belly", "kick", {});
      return { ok: true, message: "Baby heard you. Bond +8." };

    case "baby_size": {
      const progress = computeProgress(new Date(preg.conceived_at), preg.duration_days);
      const milestone = milestoneForWeek(progress.week);
      return {
        ok: true,
        message: `Baby is about the size of a ${milestone.size}: ${milestone.lengthCm} cm and ${milestone.weightG} g.`,
      };
    }

    case "baby_position": {
      const progress = computeProgress(new Date(preg.conceived_at), preg.duration_days);
      return {
        ok: true,
        message:
          progress.week >= 34
            ? "Baby is settling head down."
            : "Baby is still turning and getting cozy.",
      };
    }

    case "ultrasound": {
      const progress = computeProgress(new Date(preg.conceived_at), preg.duration_days);
      const milestone = milestoneForWeek(progress.week);
      await applyCare(
        momId,
        preg.id,
        action,
        { mood: 8, stress: -4, baby_bond: 8 },
        "Ultrasound moment",
      );
      await addJournal(
        momId,
        "Ultrasound memory",
        `Week ${progress.week}+${progress.day}: baby measured like a ${milestone.size}.`,
        "milestone",
      );
      await queueCommand(momId, "hud", "heartbeat", {
        text: `Ultrasound: baby is about the size of a ${milestone.size}.`,
      });
      return { ok: true, message: "Ultrasound memory saved." };
    }

    case "ultrasound_seen":
      await db().query(
        `update ultrasounds set seen = true where pregnancy_id = $1 and seen = false`,
        [preg.id],
      );
      return { ok: true, message: "Scrapbook updated." };

    case "appointment":
      await applyCare(
        momId,
        preg.id,
        action,
        { immunity: 10, stress: -8, baby_wellness: 5 },
        "Appointment scheduled",
      );
      await addJournal(
        momId,
        "Appointment scheduled",
        str("body", 500) || "A prenatal appointment/check-in was scheduled.",
        "appointment",
        false,
      );
      await addNotification(
        momId,
        "Appointment scheduled",
        "Your check-up reminder is in the journal.",
      );
      return { ok: true, message: "Appointment scheduled." };

    // ---- self care (mom) --------------------------------------------------
    case "drink_water":
      await applyCare(
        momId,
        preg.id,
        action,
        { hydration: 25, bladder: -10, baby_wellness: 2 },
        "Drank water",
      );
      await queueCommand(momId, "hud", "drink", {});
      await queueCommand(momId, "hud", "say", {
        text: "You sip some refreshing water. Hydration +25.",
      });
      return { ok: true, message: "You drink some water. Hydration restored." };

    case "eat":
    case "food_eat": {
      const food = foodByKey(str("food", 80)) ?? foodByKey(str("foodKey", 80)) ?? FOOD_ITEMS[0];
      await applyCare(momId, preg.id, "eat", food.deltas, `Ate ${food.name}`);
      await queueCommand(momId, "hud", "say", {
        text: `${actorName} eats ${food.name}. ${food.note}`,
      });
      return { ok: true, message: `${food.name} eaten. ${food.note}` };
    }
    case "rest":
      await applyCare(
        momId,
        preg.id,
        action,
        { energy: 30, rest: 30, comfort: 10, sickness: -3, stress: -5 },
        "Rested",
      );
      await queueCommand(momId, "hud", "rest", {});
      await queueCommand(momId, "hud", "say", { text: "You take a peaceful rest. Energy +30." });
      return { ok: true, message: "You take a moment to rest." };

    case "vitamins":
      await applyCare(
        momId,
        preg.id,
        action,
        { vitamins: 40, immunity: 10, nutrition: 8, baby_wellness: 4 },
        "Took vitamins",
      );
      await queueCommand(momId, "hud", "vitamins", {});
      await queueCommand(momId, "hud", "say", {
        text: "Prenatal vitamins taken. Immunity boosted.",
      });
      return { ok: true, message: "Prenatal vitamins taken." };

    case "medicine":
      await applyCare(
        momId,
        preg.id,
        action,
        { sickness: -25, hydration: -3, comfort: 6, stress: -2 },
        "Took nausea medicine",
      );
      await queueCommand(momId, "hud", "say", {
        text: "Nausea medicine taken. Sickness eased.",
      });
      return { ok: true, message: "Nausea medicine taken. Sickness eased." };

    case "bathroom":
      await applyCare(momId, preg.id, action, { bladder: 100, comfort: 5 }, "Bathroom break");
      await queueCommand(momId, "hud", "say", { text: "Much better! Bladder relieved." });
      return { ok: true, message: "Much better!" };

    case "comfort":
      // Rezzes the comfort chair in-world; the payoff lands via comfort_complete
      // after the wearer has sat on it for 2 minutes.
      await queueCommand(momId, "hud", "rez_chair", {});
      await queueCommand(momId, "hud", "say", {
        text: "Your comfy chair is being set out - have a seat and relax for 2 minutes.",
      });
      return {
        ok: true,
        message: "Comfy chair rezzed in-world - sit on it for 2 minutes to relax.",
      };

    case "comfort_complete":
      await applyCare(
        momId,
        preg.id,
        action,
        { comfort: 25, rest: 10, mood: 5, stress: -8 },
        "Relaxed in the comfy chair",
      );
      await queueCommand(momId, "hud", "say", {
        text: "So cozy. Comfort +25, stress melts away.",
      });
      return { ok: true, message: "You feel wonderfully relaxed ☁️ Comfort +25" };

    case "breathe":
      await applyCare(
        momId,
        preg.id,
        action,
        { mood: 6, stress: -8, comfort: 4 },
        "Breathing exercise",
      );
      await queueCommand(momId, "hud", "say", {
        text: `${actorName} slows her breathing and relaxes.`,
      });
      return { ok: true, message: "Breathing helped. Stress eased." };

    case "warm_bath":
      await applyCare(
        momId,
        preg.id,
        action,
        { comfort: 12, mood: 6, stress: -6, energy: 4 },
        "Warm bath",
      );
      await queueCommand(momId, "hud", "say", {
        text: `${actorName} takes a warm bath and lets her body soften.`,
      });
      return { ok: true, message: "Warm bath logged. Comfort +12." };

    case "snack":
      await applyCare(
        momId,
        preg.id,
        action,
        { hunger: 14, nutrition: 4, sickness: -2, mood: 3 },
        "Snack",
      );
      await queueCommand(momId, "hud", "say", {
        text: `${actorName} has a small pregnancy-friendly snack.`,
      });
      return { ok: true, message: "Snack logged." };

    // ---- affection & partner ----------------------------------------------
    case "hug": {
      await bumpStats(momId, { mood: 10, comfort: 10 });
      await queueCommand(momId, "hud", "hearts", {});
      await queueCommand(momId, "belly", "say", { text: "Baby feels the love." });
      if (isPartner) {
        await addPartnerActivity(preg.id, actorName, "Gave affection", 8);
        await queueCommand(momId, "hud", "say", { text: `${actorName} wraps you in a warm hug.` });
        return { ok: true, message: `You hug ${momName} tight.`, anim: "hug" };
      }
      await addNotification(momId, "Self care ♥", "You took a moment for yourself and baby.");
      return { ok: true, message: "You wrap your arms around your bump ♥" };
    }

    case "support": {
      await bumpStats(momId, { mood: 8 });
      if (isPartner) {
        await addPartnerActivity(preg.id, actorName, "Words of encouragement", 6);
        await addNotification(
          momId,
          `${actorName} is cheering for you`,
          "“You're doing amazing — I love you both.”",
        );
        await queueCommand(momId, "hud", "say", {
          text: `${actorName} sends words of encouragement.`,
        });
      } else {
        await addNotification(
          momId,
          "A little encouragement",
          "You're doing great! Keep taking care of yourself. ♥",
        );
        await queueCommand(momId, "hud", "chime", {});
      }
      return { ok: true, message: "Encouragement sent." };
    }

    case "ask_partner": {
      const request = str("request", 160) || `${momName} could use a little support.`;
      if (!preg.partner_user_id) return { ok: false, message: "No partner is linked yet." };
      await addNotification(preg.partner_user_id, "Partner support request", request);
      await queueCommand(preg.partner_user_id, "partner", "say", { text: request });
      return { ok: true, message: "Partner support request sent." };
    }

    case "partner_message": {
      const note = str("note") || "Thinking of you.";
      await bumpStats(momId, { mood: 6 });
      await addPartnerActivity(preg.id, actorName, "Sent a sweet message", 4);
      await addNotification(momId, `Message from ${actorName}`, note);
      await queueCommand(momId, "hud", "say", { text: `${actorName}: ${note}` });
      return { ok: true, message: "Message delivered." };
    }

    case "partner_water":
      await bumpStats(momId, { hydration: 20 });
      await addPartnerActivity(preg.id, actorName, "Brought a glass of water", 5);
      await queueCommand(momId, "hud", "say", {
        text: `${actorName} brings you a glass of water.`,
      });
      return { ok: true, message: `You bring ${momName} some water.` };

    case "partner_backrub":
      await bumpStats(momId, { comfort: 20, mood: 8 });
      await addPartnerActivity(preg.id, actorName, "Gave a back rub", 7);
      await queueCommand(momId, "hud", "say", {
        text: `${actorName} gives you a gentle back rub.`,
      });
      return { ok: true, message: "A soothing back rub." };

    case "partner_appointment":
      await addPartnerActivity(preg.id, actorName, "Attended an appointment", 10);
      await addJournal(
        momId,
        "Appointment together",
        `${actorName} came along to the appointment.`,
        "appointment",
      );
      await queueCommand(momId, "hud", "say", {
        text: `${actorName} joined you at your appointment.`,
      });
      return { ok: true, message: "Appointment attended together." };

    case "partner_status": {
      const progress = computeProgress(new Date(preg.conceived_at), preg.duration_days);
      const stats = await getStatsWithDecay(momId, progress.trimester);
      return {
        ok: true,
        message: `${momName} - week ${progress.week}+${progress.day} (${progress.progressPct}%). Mood ${stats.mood}%, energy ${stats.energy}%, hydration ${stats.hydration}%.`,
      };
    }

    // ---- cravings / random events -----------------------------------------
    case "craving_roll": {
      const progress = computeProgress(new Date(preg.conceived_at), preg.duration_days);
      const craving = await ensureCraving(preg.id, progress.trimester);
      await applyCare(
        momId,
        preg.id,
        action,
        { mood: -2, stress: 3 },
        `Craving started: ${craving.craving}`,
      );
      await recordEvent(
        preg.id,
        momId,
        "craving",
        "Craving event",
        `${momName} is craving ${craving.craving}.`,
      );
      await queueCommand(momId, "hud", "dialog", {
        kind: "craving",
        eventType: "craving",
        title: "NESTORIA CRAVING EVENT",
        body: `${momName} is craving ${craving.craving}.\n\nIntensity: ${craving.intensity}%\nChoose 1-5, or use the MOAP hub for more detail.`,
      });
      return {
        ok: true,
        message: `${momName} is craving ${craving.craving}. Intensity ${craving.intensity}%.`,
        craving,
      };
    }

    case "craving_set": {
      const cravingText = str("craving", 80);
      if (!cravingText) return { ok: false, message: "What are you craving?" };
      await db().query(`update cravings set active = false where pregnancy_id = $1`, [preg.id]);
      const matchingFood = foodForCraving(cravingText);
      const { rows } = await db().query(
        `insert into cravings (pregnancy_id, craving, category, intensity)
         values ($1, $2, $3, $4)
         returning id, craving, category, intensity, relief, sweets_streak, updated_at`,
        [preg.id, cravingText, str("category", 30) || matchingFood.category, 60],
      );
      await applyCare(
        momId,
        preg.id,
        action,
        { mood: 2, stress: -1 },
        `Craving edited: ${cravingText}`,
      );
      await recordEvent(
        preg.id,
        momId,
        "craving",
        "Craving updated",
        `Current craving updated to ${cravingText}.`,
      );
      return { ok: true, message: `Current craving updated to: ${cravingText}.`, craving: rows[0] };
    }

    case "craving_choice": {
      const choice = str("choice", 30) || "eat";
      const progress = computeProgress(new Date(preg.conceived_at), preg.duration_days);
      const craving = await ensureCraving(preg.id, progress.trimester);
      if (choice === "healthy") {
        await applyCare(
          momId,
          preg.id,
          action,
          { nutrition: 8, baby_wellness: 4, mood: 5, hunger: 8 },
          "Healthy craving swap",
        );
        await db().query(
          `update cravings set relief = least(100, relief + 15), intensity = greatest(0, intensity - 15), sweets_streak = 0, updated_at = now() where id = $1`,
          [craving.id],
        );
        return {
          ok: true,
          message: `${momName} chooses a healthier snack. Nutrition +8, Baby Wellness +4.`,
        };
      }
      if (choice === "ask_partner") {
        await applyCare(
          momId,
          preg.id,
          action,
          { mood: 2, stress: -2 },
          "Asked partner for craving help",
        );
        if (preg.partner_user_id) {
          await addNotification(
            preg.partner_user_id,
            `${momName} has a craving`,
            `${momName} is craving ${craving.craving}. Would you like to help?`,
          );
          await queueCommand(preg.partner_user_id, "partner", "say", {
            text: `${momName} is craving ${craving.craving}.`,
          });
        }
        return { ok: true, message: "Partner request sent." };
      }
      if (choice === "ignore") {
        await applyCare(momId, preg.id, action, { mood: -4 }, "Ignored craving");
        await db().query(
          `update cravings set intensity = least(100, intensity + 10), updated_at = now() where id = $1`,
          [craving.id],
        );
        return { ok: true, message: `${momName} tries to ignore the craving. Intensity rises.` };
      }
      if (choice === "journal") {
        await applyCare(
          momId,
          preg.id,
          action,
          { mood: 2, stress: -1 },
          "Saved craving to journal",
        );
        await addJournal(
          momId,
          "Craving memory",
          `Today ${momName} craved ${craving.craving}.`,
          "memory",
        );
        return { ok: true, message: "Craving saved to journal." };
      }
      const food = foodByKey(str("food", 80)) ?? foodForCraving(craving.craving);
      const sweetPenalty = food.category === "sweet" && Number(craving.sweets_streak) >= 2 ? -3 : 0;
      await applyCare(
        momId,
        preg.id,
        action,
        {
          ...food.deltas,
          nutrition: (food.deltas.nutrition ?? 0) + sweetPenalty,
          baby_movement: (food.deltas.baby_movement ?? 0) + 4,
        },
        `Ate craving: ${food.name}`,
      );
      await db().query(
        `update cravings set relief = least(100, relief + 30),
           intensity = greatest(0, intensity - 30),
           category = $2,
           craving = $3,
           sweets_streak = case when $2 = 'sweet' then sweets_streak + 1 else 0 end,
           updated_at = now()
         where id = $1`,
        [craving.id, food.category, food.name],
      );
      await queueCommand(momId, "belly", "kick", {});
      return {
        ok: true,
        message: `${momName} gives in to the ${food.name} craving. Baby reacts with tiny kicks.`,
      };
    }

    case "random_event_roll": {
      const progress = computeProgress(new Date(preg.conceived_at), preg.duration_days);
      const roll = Math.random();
      const sicknessRisk = stats.sickness > 55 || progress.trimester === 1;
      let eventType = "baby_kick";
      let title = "Tiny kick";
      let body = "You feel a tiny kick. The baby is moving around.";
      let eventDeltas: Partial<Record<StatName, number>> = {
        mood: 3,
        baby_movement: 5,
        baby_bond: 2,
      };
      if (sicknessRisk && roll <= 0.35) {
        const sicknessEvents = [
          {
            eventType: "nausea",
            title: "Nausea wave",
            body: "A wave of nausea rolls in. Medicine, water, a light snack, or rest can settle it.",
            deltas: { sickness: 6, mood: -2, stress: 2 },
          },
          {
            eventType: "heartburn",
            title: "Heartburn",
            body: "A warm burn creeps up after eating. Water and a calmer snack may help.",
            deltas: { sickness: 4, comfort: -3, stress: 1 },
          },
          {
            eventType: "dizzy",
            title: "Dizzy spell",
            body: "You feel a little dizzy. Sit, sip water, and take it slow.",
            deltas: { sickness: 5, energy: -4, hydration: -3 },
          },
        ];
        const event = sicknessEvents[Math.floor(Math.random() * sicknessEvents.length)];
        eventType = event.eventType;
        title = event.title;
        body = event.body;
        eventDeltas = event.deltas;
      } else if (roll > 0.4 && roll <= 0.65) {
        eventType = stats.hydration < 45 ? "hydration" : "fatigue";
        title = stats.hydration < 45 ? "Hydration reminder" : "Fatigue";
        body =
          stats.hydration < 45
            ? "You are starting to feel thirsty."
            : "Your body feels heavy and tired.";
        eventDeltas =
          stats.hydration < 45 ? { hydration: -4, stress: 2 } : { energy: -5, rest: -4 };
      } else if (roll > 0.65 && roll <= 0.85) {
        eventType = stats.sickness > 45 ? "nausea" : "mood";
        title = stats.sickness > 45 ? "Nausea wave" : "Mood swing";
        body =
          stats.sickness > 45
            ? "A wave of nausea comes over you."
            : "Your emotions feel extra strong right now.";
        eventDeltas =
          stats.sickness > 45 ? { sickness: 4, mood: -2, stress: 2 } : { mood: -3, stress: 4 };
      } else if (roll > 0.85 && roll <= 0.95) {
        eventType = "partner";
        title = "Support prompt";
        body = `${momName} seems tired today. A little support could help.`;
        eventDeltas = { mood: 1, stress: 1 };
      } else if (roll > 0.95 || progress.week >= 34) {
        eventType = progress.week >= 34 ? "late_pregnancy" : "nesting";
        title = progress.week >= 34 ? "Belly tightening" : "Nesting moment";
        body =
          progress.week >= 34
            ? "You feel a tightening in your belly. Keep it RP-safe: breathe, rest, hydrate, or schedule a check-in."
            : "You suddenly feel the urge to prepare for the baby.";
        eventDeltas =
          progress.week >= 34
            ? { comfort: -4, stress: 5, energy: -2 }
            : { mood: 5, energy: -3, stress: -2 };
      }
      await applyCare(momId, preg.id, action, eventDeltas, `Random event: ${title}`);
      await recordEvent(preg.id, momId, eventType, title, body);
      await addNotification(momId, title, body);
      await queueCommand(momId, "hud", "dialog", {
        kind: "event",
        eventType,
        title,
        body,
      });
      return { ok: true, message: `${title}: ${body}`, event: { eventType, title, body } };
    }

    case "random_event_choice": {
      const eventType = str("eventType", 40);
      const choice = str("choice", 40);
      const effects: Record<string, Partial<Record<StatName, number>>> = {
        rub_belly: { baby_bond: 5, mood: 5 },
        count_kick: { baby_movement: 4 },
        rest: { sickness: -5, energy: 5, rest: 8 },
        water: { hydration: 15, baby_wellness: 2 },
        medicine: { sickness: -22, comfort: 5, stress: -2 },
        snack: { sickness: -8, hunger: 10, mood: 2 },
        nap: { energy: 20, mood: 5, rest: 15 },
        breathe: { mood: 6, stress: -5 },
        journal: { mood: 4 },
        organize: { mood: 8 },
        ignore: { mood: -3, hydration: -3 },
      };
      const deltas = effects[choice] ?? { mood: 2 };
      await applyCare(momId, preg.id, action, deltas, `Event choice: ${choice}`);
      if (choice === "journal")
        await addJournal(
          momId,
          "Event memory",
          `Handled ${eventType || "a moment"} with ${choice}.`,
          "memory",
        );
      if (choice === "count_kick")
        await db().query(`insert into kick_events (pregnancy_id, source) values ($1, 'web')`, [
          preg.id,
        ]);
      await recordEvent(
        preg.id,
        momId,
        eventType || "manual",
        "Event choice",
        `Choice selected: ${choice}.`,
        choice,
      );
      return { ok: true, message: "Event choice saved." };
    }

    // ---- medical / events --------------------------------------------------
    case "doctor": {
      const progress = computeProgress(new Date(preg.conceived_at), preg.duration_days);
      const bpm = heartbeatForWeek(progress.week);
      const heartLine =
        bpm > 0
          ? `Baby's heartbeat: ${bpm} bpm - strong and healthy.`
          : "Too early to hear the heartbeat yet - everything looks wonderful.";
      await bumpStats(momId, { immunity: 15, sickness: -20 });
      await addJournal(
        momId,
        "Prenatal check-up",
        `Week ${progress.week} check-up. ${heartLine}`,
        "appointment",
      );
      await addNotification(momId, "Check-up complete", heartLine);
      await queueCommand(momId, "hud", bpm > 0 ? "heartbeat" : "say", { text: `[Check-up] ${heartLine}` });
      return { ok: true, message: `Check-up done. ${heartLine}` };
    }

    case "kick": {
      await db().query(`insert into kick_events (pregnancy_id, source) values ($1, $2)`, [
        preg.id,
        source === "sl" ? "belly" : "web",
      ]);
      if (source !== "sl") await queueCommand(momId, "belly", "kick", {});
      await queueCommand(momId, "hud", "kick", { text: "Baby is kicking!" });
      return { ok: true, message: "Kick logged." };
    }

    case "belly_touch": {
      const toucher = str("toucher_name", 80) || "Someone";
      await bumpStats(momId, { mood: 4 });
      if (preg.partner_name && toucher.startsWith(preg.partner_name))
        await addPartnerActivity(preg.id, toucher, "Cuddled the bump", 4);
      await queueCommand(momId, "hud", "say", { text: `${toucher} gently touches your bump.` });
      return { ok: true, message: "So sweet." };
    }

    // ---- journal / memory / events -----------------------------------------
    case "memory": {
      const title = str("title", 120) || "A beautiful moment";
      await addJournal(momId, title, str("body", 2000) || null, "memory");
      await queueCommand(momId, "hud", "chime", {});
      return { ok: true, message: "Memory saved to your journal." };
    }

    case "journal_add": {
      const title = str("title", 120);
      if (!title) return { ok: false, message: "The entry needs a title." };
      const kind = (["note", "milestone", "memory", "appointment"] as const).includes(
        params.kind as never,
      )
        ? (params.kind as "note" | "milestone" | "memory" | "appointment")
        : "note";
      await addJournal(momId, title, str("body", 2000) || null, kind, kind !== "appointment");
      return { ok: true, message: "Journal entry added 📖" };
    }

    case "event": {
      const title = str("title", 120) || "Upcoming event";
      await addJournal(momId, title, str("body", 2000) || null, "appointment", false);
      await addNotification(momId, "Event scheduled 📅", title);
      return { ok: true, message: "Event added to your calendar 📅" };
    }

    // ---- symptoms -----------------------------------------------------------
    case "symptom_log": {
      const name = str("name", 60);
      const severity = clamp(Number(params.severity ?? 0));
      if (!name) return { ok: false, message: "Which symptom?" };
      await db().query(
        `insert into symptoms (pregnancy_id, name, severity, updated_at)
         values ($1, $2, $3, now())
         on conflict (pregnancy_id, name) do update
           set severity = excluded.severity, updated_at = now()`,
        [preg.id, name, Math.round(severity)],
      );
      return { ok: true, message: `${name} updated to ${severityLabel(severity)}.` };
    }

    // ---- settings / meta ----------------------------------------------------
    case "settings_update": {
      const patch: Record<string, unknown> = {};
      if (typeof params.babyName === "string") patch.babyName = str("babyName", 60);
      if (
        typeof params.babyGender === "string" &&
        ["girl", "boy", "twins", "surprise"].includes(params.babyGender as string)
      )
        patch.babyGender = params.babyGender;
      if (params.durationDays != null) {
        const d = Math.round(Number(params.durationDays));
        if (d >= 1 && d <= 280) patch.durationDays = d;
      }
      if (patch.babyName !== undefined)
        await db().query(
          `update pregnancies set baby_name = $2, updated_at = now() where id = $1`,
          [preg.id, (patch.babyName as string) || null],
        );
      if (patch.babyGender !== undefined)
        await db().query(
          `update pregnancies set baby_gender = $2, updated_at = now() where id = $1`,
          [preg.id, patch.babyGender],
        );
      if (patch.durationDays !== undefined) {
        // keep the current week where it is: rescale conceived_at so the
        // elapsed fraction stays the same under the new duration
        const oldDuration = Number(preg.duration_days);
        const frac = Math.min(
          1,
          Math.max(
            0,
            (Date.now() - new Date(preg.conceived_at).getTime()) / (oldDuration * 86_400_000),
          ),
        );
        const newConceived = new Date(
          Date.now() - frac * (patch.durationDays as number) * 86_400_000,
        );
        await db().query(
          `update pregnancies set duration_days = $2, conceived_at = $3, updated_at = now() where id = $1`,
          [preg.id, patch.durationDays, newConceived.toISOString()],
        );
      }
      if (typeof params.settings === "object" && params.settings !== null)
        await db().query(
          `insert into user_settings (user_id, settings) values ($1, $2)
           on conflict (user_id) do update set settings = user_settings.settings || excluded.settings`,
          [user.id, JSON.stringify(params.settings)],
        );
      return { ok: true, message: "Settings saved ✓" };
    }

    case "notifications_read":
      await db().query(`update notifications set read = true where user_id = $1`, [user.id]);
      return { ok: true, message: "Notifications marked as read." };

    default:
      return { ok: false, message: `Unknown action: ${action}` };
  }
}

// ---------------------------------------------------------------------------
// Registration (LSL entry point)
// ---------------------------------------------------------------------------

export async function registerDevice(opts: {
  avatarKey: string;
  avatarName: string;
  kind: "hud" | "belly" | "partner";
  objectKey: string;
  callbackUrl: string | null;
  region: string | null;
}) {
  const role = opts.kind === "partner" ? "partner" : "mom";
  const user = await getOrCreateUser(opts.avatarKey, opts.avatarName, role);
  await upsertDevice(user.id, opts.kind, opts.objectKey, opts.callbackUrl, opts.region);

  let week = 0;
  if (user.role === "mom") {
    const preg = await ensureActivePregnancy(user.id);
    week = computeProgress(new Date(preg.conceived_at), preg.duration_days).week;
  } else {
    const preg = await pregnancyForUser(user);
    if (preg) week = computeProgress(new Date(preg.conceived_at), preg.duration_days).week;
  }

  const token = await createSession(user.id);
  return {
    token,
    week,
    moap_url: `${appUrl()}/?token=${token}`,
    welcome: `Welcome back, ${user.avatar_name.split(" ")[0]} - Week ${week} - touch the screen to open your dashboard.`,
  };
}
