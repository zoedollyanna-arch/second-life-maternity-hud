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
import { moodFromKey, rpLineFor, type MoodKey } from "../mood";
import {
  rollEvent,
  choiceByKey,
  choicesForEventKey,
  EVENT_CATEGORIES,
  type EventCategory,
  type EventChoice,
  type RolledEvent,
} from "../events";
import {
  DEFAULT_PREFERENCES,
  DECAY_MULTIPLIER,
  TEST_MODE_CODE,
  disabledCategories,
  normalizePreferences,
  type AnimationKey,
  type HudPreferences,
  type PartnerNotifyKey,
} from "../preferences";
import { CRAVING_POOL, FOOD_ITEMS, foodByKey, foodForCraving, foodSummary } from "../foods";
import {
  PARTNER_ACTIONS,
  HOSPITAL_BAG_ITEMS,
  KICK_FRESH_MS,
  REACTION_STYLES,
  PARTNER_TITLES,
  type PartnerPermission,
} from "../partner";
import {
  queueCommand,
  takePendingCommands,
  addNotification,
  publishEvent,
  recentEvents,
  type EventSeverity,
} from "./bus";
import { runLaborEngine, snapshotOf, laborStageFor, type LaborTransition } from "./labor";
import * as partnerSvc from "./partner";

// Re-exported so existing importers of game.ts keep working after the command
// queue and notification helpers moved into bus.ts.
export { queueCommand, takePendingCommands, addNotification };
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
  const { rows } = await db().query(
    `insert into hud_sessions (user_id) values ($1) returning token`,
    [userId],
  );
  await db().query(
    `delete from hud_sessions
     where user_id = $1
       and token not in (
         select token from hud_sessions
         where user_id = $1 and expires_at > now()
         order by created_at desc limit 5
       )`,
    [userId],
  );
  return rows[0].token as string;
}

export async function resolveSession(token: string | null): Promise<HudUser | null> {
  if (!token || !/^[0-9a-f-]{36}$/i.test(token)) return null;
  const { rows } = await db().query(
    `select u.id, u.avatar_key, u.avatar_name, u.display_name, u.role
     from hud_sessions s
     join hud_users u on u.id = s.user_id
     where s.token = $1 and s.expires_at > now()`,
    [token],
  );
  return (rows[0] as HudUser) ?? null;
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
    `insert into pregnancies (user_id, partner_code) values ($1, $2)
     on conflict (user_id) where status = 'active'
     do update set updated_at = pregnancies.updated_at
     returning *, (xmax = 0) as was_inserted`,
    [userId, partnerCode()],
  );
  const preg = created.rows[0];
  if (!preg.was_inserted) return preg;
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

function isDeliveredPregnancy(preg: { status?: string; labor_stage?: string } | null | undefined) {
  return preg?.status === "delivered" || preg?.labor_stage === "delivered";
}

/** Latest pregnancy for this mom, including delivered. Does not start a new one. */
async function latestPregnancyForMom(userId: string) {
  const { rows } = await db().query(
    `select * from pregnancies
      where user_id = $1
      order by case when status = 'active' then 0 else 1 end, updated_at desc
      limit 1`,
    [userId],
  );
  return rows[0] ?? null;
}

/**
 * For partners: find the pregnancy they hold an ACTIVE link to.
 *
 * The join against pregnancy_partner_links is the authorisation boundary — a
 * pending, declined or removed partner resolves to nothing, and no pregnancy id
 * supplied by a browser is ever consulted, so knowing one grants no access.
 *
 * Every read of a pregnancy also advances the labor engine, which is how labor
 * progresses without a cron: either HUD looking at the pregnancy moves it.
 */
export async function pregnancyForUser(user: HudUser) {
  if (user.role === "partner") {
    const { rows } = await db().query(
      `select p.*, u.avatar_key as mom_avatar_key, u.avatar_name as mom_avatar_name,
              u.id as mom_user_id
       from pregnancies p
       join pregnancy_partner_links l
         on l.pregnancy_id = p.id and l.status = 'active'
       join hud_users u on u.id = p.user_id
       where l.partner_user_id = $1
       order by case when p.status = 'active' then 0 else 1 end, p.updated_at desc
       limit 1`,
      [user.id],
    );
    if (!rows[0]) return null;
    return await tickLabor(rows[0]);
  }
  const existing = await latestPregnancyForMom(user.id);
  const preg = existing ?? (await ensureActivePregnancy(user.id));
  const ticked = await tickLabor(preg);
  return {
    ...ticked,
    mom_avatar_key: user.avatar_key,
    mom_avatar_name: user.avatar_name,
    mom_user_id: user.id,
  };
}

// ---------------------------------------------------------------------------
// Stats with lazy decay
// ---------------------------------------------------------------------------

export async function getStatsWithDecay(userId: string, trimester: number, pace?: number) {
  // Decay is *written*, not just displayed, so the pace must be the wearer's
  // own preference no matter who triggered the read — otherwise a partner
  // opening their HUD would decay her meters at the default rate and undo the
  // pace she chose. Callers that already hold her preferences pass it in.
  const paceMultiplier = pace ?? DECAY_MULTIPLIER[(await preferencesFor(userId)).decayPace] ?? 1;
  const client = await db().connect();
  try {
    await client.query("begin");
    await client.query(
      `insert into user_stats (user_id) values ($1) on conflict (user_id) do nothing`,
      [userId],
    );
    const { rows } = await client.query(`select * from user_stats where user_id = $1 for update`, [
      userId,
    ]);
    const stats = rows[0];
    const hours = (Date.now() - new Date(stats.updated_at).getTime()) / 3_600_000;
    if (hours < 0.05) {
      await client.query("commit");
      return normalizeStats(stats);
    }

    const updated = decayStats(stats, trimester, hours, paceMultiplier);
    const { rows: saved } = await client.query(
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
    await client.query("commit");
    return normalizeStats(saved[0]);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

function normalizeStats(row: Record<string, unknown>) {
  const out: Record<StatName, number> = {} as Record<StatName, number>;
  for (const name of STAT_NAMES) out[name] = Math.round(Number(row[name]));
  return out;
}

function decayStats(row: Record<string, unknown>, trimester: number, hours: number, pace = 1) {
  const base = normalizeStats(row);
  const updated: Record<StatName, number> = {} as Record<StatName, number>;
  // `pace` is her Realism preference: gentle play drifts slowly, realistic play
  // drifts fast. It scales elapsed time rather than each rate, so the connected
  // -meter knock-ons below scale with it for free.
  const activeHours = smartDecayHours(hours) * Math.max(0.1, pace);
  for (const name of STAT_NAMES) {
    let rate = DECAY_PER_HOUR[name];
    if (name === "sickness") rate = trimester === 1 ? 1.1 : -1.2;
    if (name === "immunity" && Number(base.vitamins) < 20) rate = -2;
    if (rate < 0 && Number(base[name]) < 25) rate *= 0.45;
    if (rate > 0 && Number(base[name]) > 75) rate *= 0.45;
    updated[name] = clamp(Number(base[name]) + rate * activeHours);
  }
  // Connected meters: one low stat pulls others with it.
  if (base.hydration < 30) {
    updated.energy = clamp(updated.energy - 0.8 * activeHours);
    updated.sickness = clamp(updated.sickness + 0.6 * activeHours);
    updated.mood = clamp(updated.mood - 0.4 * activeHours);
  }
  if (base.hunger < 25) {
    updated.mood = clamp(updated.mood - 0.9 * activeHours);
    updated.stress = clamp(updated.stress + 0.7 * activeHours);
  }
  if (base.bladder < 20) {
    updated.comfort = clamp(updated.comfort - 1.2 * activeHours);
    updated.mood = clamp(updated.mood - 0.3 * activeHours);
  }
  if (base.energy < 20 || base.rest < 25) {
    updated.mood = clamp(updated.mood - 0.5 * activeHours);
    updated.stress = clamp(updated.stress + 0.4 * activeHours);
  }
  if (base.sickness > 60) {
    updated.hunger = clamp(updated.hunger - 0.6 * activeHours);
    updated.energy = clamp(updated.energy - 0.5 * activeHours);
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

// ---------------------------------------------------------------------------
// Wearer preferences
//
// One read, one validation path. Everything downstream — the event roller, the
// decay pace, which animations fire, what reaches the partner HUD — asks this
// rather than poking at the settings blob, so a malformed or half-migrated row
// degrades to the documented defaults instead of throwing mid-action.
// ---------------------------------------------------------------------------

export async function preferencesFor(userId: string): Promise<HudPreferences> {
  const { rows } = await db().query(`select settings from user_settings where user_id = $1`, [
    userId,
  ]);
  return normalizePreferences(rows[0]?.settings ?? {});
}

async function savePreferences(userId: string, patch: Partial<HudPreferences>) {
  const current = await preferencesFor(userId);
  const merged = normalizePreferences({ ...current, ...patch }, current);
  await db().query(
    `insert into user_settings (user_id, settings) values ($1, $2::jsonb)
     on conflict (user_id) do update set settings = user_settings.settings || $2::jsonb`,
    [userId, JSON.stringify(merged)],
  );
  return merged;
}

/**
 * Queue an in-world flourish only if she still wants that one. The command
 * queue itself stays dumb — the decision belongs here, where the preference
 * lives, so the LSL scripts never have to know about settings.
 */
async function queueAnim(
  userId: string,
  kind: "hud" | "belly" | "partner",
  command: AnimationKey,
  params: Record<string, unknown> = {},
  prefs?: HudPreferences,
) {
  const resolved = prefs ?? (await preferencesFor(userId));
  if (!resolved.animations[command]) return;
  await queueCommand(userId, kind, command, params);
}

/** Sound-only cue. Silent when she has HUD sounds switched off. */
async function queueChime(userId: string, prefs?: HudPreferences) {
  const resolved = prefs ?? (await preferencesFor(userId));
  if (!resolved.soundEnabled) return;
  await queueCommand(userId, "hud", "chime", {});
}

/** Does this event family reach the partner HUD at all? */
function partnerWants(prefs: HudPreferences, key: PartnerNotifyKey): boolean {
  return prefs.partnerNotify[key] !== false;
}

const CATEGORY_TO_NOTIFY: Record<EventCategory, PartnerNotifyKey | null> = {
  mood: "mood",
  sickness: "sickness",
  craving: "craving",
  baby: "baby",
  body: "body",
  nesting: null,
  partner: "mood",
  sweet: null,
};

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
  const pool = CRAVING_POOL[trimester === 1 ? 1 : trimester === 2 ? 2 : 3];
  const food = foodByKey(pool[Math.floor(Math.random() * pool.length)]) ?? FOOD_ITEMS[0];
  const { rows } = await db().query(
    `insert into cravings (pregnancy_id, craving, category, intensity)
     values ($1, $2, $3, $4)
     on conflict (pregnancy_id) where active = true
     do update set updated_at = cravings.updated_at
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

/**
 * Write a closed, historical event. Used for anything that is a record rather
 * than a question — a choice she has already made, or a manual log.
 */
async function recordEvent(
  pregnancyId: string,
  userId: string,
  eventType: string,
  title: string,
  body: string,
  choice?: string,
  category: EventCategory | string = "mood",
) {
  await db().query(
    `insert into event_history
       (pregnancy_id, user_id, event_type, title, body, choice, category, answered_at)
     values ($1, $2, $3, $4, $5, $6, $7, now())`,
    [pregnancyId, userId, eventType, title, body, choice ?? null, category],
  );
}

// ---------------------------------------------------------------------------
// RP event engine
//
// The catalogue and the weighting live in src/lib/events.ts. What lives here is
// everything that needs the database: what fired recently (so the roller can
// avoid repeating it), storing the open popup, and closing it when she answers
// on either surface.
// ---------------------------------------------------------------------------

/** How long an unanswered popup blocks the next one before it lapses. */
const EVENT_TTL_MINUTES = 12;

/** Age out an abandoned popup so a HUD taken off mid-dialog is never stuck. */
async function expireStaleEvents(pregnancyId: string) {
  await db().query(
    `update event_history set answered_at = now(), choice = 'expired'
      where pregnancy_id = $1 and answered_at is null and expires_at < now()`,
    [pregnancyId],
  );
}

export interface ActiveEvent {
  id: string;
  key: string;
  category: string;
  title: string;
  body: string;
  choices: { key: string; label: string; short: string; line: string }[];
  createdAt: string;
  expiresAt: string | null;
}

/** The one open question, if there is one. Both HUD surfaces render this. */
async function activeEventFor(pregnancyId: string): Promise<ActiveEvent | null> {
  await expireStaleEvents(pregnancyId);
  const { rows } = await db().query(
    `select id, event_type, category, title, body, choices, created_at, expires_at
       from event_history
      where pregnancy_id = $1 and answered_at is null
      order by created_at desc limit 1`,
    [pregnancyId],
  );
  const row = rows[0];
  if (!row) return null;
  const stored = Array.isArray(row.choices) ? row.choices : [];
  const choices = stored.length
    ? stored
    : choicesForEventKey(String(row.event_type)).map((c) => ({
        key: c.key,
        label: c.label,
        short: c.short,
        line: c.line,
      }));
  return {
    id: String(row.id),
    key: String(row.event_type),
    category: String(row.category ?? "mood"),
    title: String(row.title),
    body: String(row.body ?? ""),
    choices,
    createdAt: String(row.created_at),
    expiresAt: row.expires_at ? String(row.expires_at) : null,
  };
}

/** Event keys from this pregnancy's recent past, newest first. */
async function recentEventKeys(pregnancyId: string, limit = 10): Promise<string[]> {
  const { rows } = await db().query(
    `select event_type from event_history
      where pregnancy_id = $1 order by created_at desc limit $2`,
    [pregnancyId, limit],
  );
  return rows.map((r) => String(r.event_type));
}

/**
 * Roll, store and deliver one RP event.
 *
 * Returns null when nothing fired — every category switched off, a popup
 * already open, or the pregnancy already delivered — so callers can say so
 * honestly instead of inventing a moment.
 */
async function rollAndDeliverEvent(
  preg: Record<string, any>,
  momId: string,
  momName: string,
  stats: Record<StatName, number>,
  prefs: HudPreferences,
): Promise<{ event: RolledEvent; id: string } | null> {
  if (isDeliveredPregnancy(preg)) return null;

  // One open question at a time. Without this, a HUD that was offline for an
  // hour comes back to a queue of blue menus all at once.
  if (await activeEventFor(preg.id)) return null;

  const progress = computeProgress(new Date(preg.conceived_at), preg.duration_days);
  const labor = snapshotOf(preg as any);

  const [supportRes, settingsRes, recentKeys] = await Promise.all([
    db().query(
      `select coalesce(sum(support_pts), 0)::int as pts from partner_activities
         where pregnancy_id = $1 and created_at > now() - interval '7 days'`,
      [preg.id],
    ),
    db().query(`select settings from user_settings where user_id = $1`, [momId]),
    recentEventKeys(preg.id),
  ]);
  const lastEmotion = settingsRes.rows[0]?.settings?.lastEmotion;

  const disabled = disabledCategories(prefs);

  const rolled = rollEvent({
    trimester: progress.trimester,
    week: progress.week,
    stats,
    mood: (typeof lastEmotion === "string" ? lastEmotion : "calm") as MoodKey,
    partnerLinked: Boolean(preg.partner_user_id),
    partnerSupport: Math.min(100, 20 + Number(supportRes.rows[0]?.pts ?? 0)),
    inLabor: labor.inLabor,
    recentKeys,
    disabled,
  });
  if (!rolled) return null;
  if (rolled.key === "craving_odd" && !prefs.allowPica) return null;

  const surface = prefs.popupSurface;
  const choicePayload = rolled.choices.map((c) => ({
    key: c.key,
    label: c.label,
    short: c.short,
    line: c.line,
  }));

  // Insert under the partial unique index — if a concurrent poll beat us here
  // the popup is already delivered, and this roll is simply dropped.
  const { rows: inserted } = await db().query(
    `insert into event_history
       (pregnancy_id, user_id, event_type, title, body, category, choices, expires_at, surface)
     values ($1, $2, $3, $4, $5, $6, $7::jsonb,
             now() + ($8::integer * interval '1 minute'), $9)
     on conflict (pregnancy_id) where answered_at is null do nothing
     returning id`,
    [
      preg.id,
      momId,
      rolled.key,
      rolled.title,
      rolled.body,
      rolled.category,
      JSON.stringify(choicePayload),
      EVENT_TTL_MINUTES,
      surface,
    ],
  );
  if (!inserted[0]) return null;
  const eventId = String(inserted[0].id);

  await applyCare(momId, preg.id, "random_event", rolled.deltas, `Event: ${rolled.title}`);
  if (rolled.moodAfter) await setRecentEmotion(momId, rolled.moodAfter, rolled.body);
  await addNotification(momId, rolled.title, rolled.body);

  // In-world flourish belonging to the event itself (a kick nudge, a chime).
  if (rolled.world) await queueAnim(momId, "hud", rolled.world as AnimationKey, {}, prefs);

  // The blue menu only goes out if she wants that surface. The HUD screen card
  // is driven by activeEventFor and needs nothing queued.
  if (surface === "both" || surface === "world") {
    await queueCommand(momId, "hud", "dialog", {
      kind: "event",
      eventType: rolled.key,
      eventId,
      title: rolled.title,
      body: rolled.body,
      // "key|Short label" pairs — the LSL builds its buttons from this instead
      // of the five hardcoded ones it used to show for every single event.
      choices: choicePayload.map((c) => c.key + "|" + c.short).join(";"),
    });
  }
  if (surface !== "off") {
    await queueCommand(momId, "hud", "say", { text: rolled.body });
  }

  const notifyKey = CATEGORY_TO_NOTIFY[rolled.category];
  if (rolled.notifyPartner && notifyKey && partnerWants(prefs, notifyKey)) {
    await notifyPartner(preg, momName + ": " + rolled.title, rolled.body, {
      eventType: rolled.key,
      permission: "viewMood",
    });
  }

  return { event: rolled, id: eventId };
}

/**
 * Close the open popup with a choice. Safe to call from the HUD screen and the
 * in-world dialog at the same time — the guarded UPDATE means the second caller
 * finds nothing to close, and the effect is applied exactly once.
 */
async function answerEvent(
  preg: Record<string, any>,
  momId: string,
  momName: string,
  choiceKey: string,
  prefs: HudPreferences,
  explicitEventId?: string,
): Promise<ActionResult> {
  let choice: EventChoice | undefined = choiceByKey(choiceKey);
  if (!choice) return { ok: false, message: "That is not one of the options." };

  // Same rule, one more doorway: an event that offered "drink some water"
  // before labor started quietly becomes ice chips rather than dead-ending.
  if (choice.key === "water" && snapshotOf(preg as any).inLabor) {
    choice = choiceByKey("ice_chips") ?? choice;
  }

  const params: unknown[] = [preg.id, choice.key];
  let where = "pregnancy_id = $1 and answered_at is null";
  if (explicitEventId && /^[0-9a-f-]{36}$/i.test(explicitEventId)) {
    where += " and id = $3";
    params.push(explicitEventId);
  }
  const { rows } = await db().query(
    `update event_history set answered_at = now(), choice = $2
      where ` +
      where +
      ` returning id, event_type, category, title`,
    params,
  );
  const closed = rows[0];
  if (!closed) {
    // Already answered on the other surface, or the popup lapsed. Say so rather
    // than silently applying the effect a second time.
    return { ok: false, message: "That moment has already passed." };
  }

  const line = choice.line.replace(/\{m\}/g, momName);

  await applyCare(momId, preg.id, "event_choice", choice.deltas, "Event choice: " + choice.key);
  if (choice.moodAfter) await setRecentEmotion(momId, choice.moodAfter, line);
  if (choice.world) await queueAnim(momId, "hud", choice.world as AnimationKey, {}, prefs);
  if (prefs.popupSurface !== "off") {
    await queueCommand(momId, "hud", "say", { text: line });
  }

  if (choice.journals) await addJournal(momId, String(closed.title), line, "memory");
  if (choice.key === "count_kick") {
    await db().query(`insert into kick_events (pregnancy_id, source) values ($1, 'web')`, [
      preg.id,
    ]);
  }
  if (choice.key === "pack_bag") await queueCommand(momId, "hud", "bag_pack", {});
  if (choice.key === "bathroom") {
    await queueAnim(momId, "hud", "bathroom", {}, prefs);
  }

  if (choice.notifiesPartner) {
    if (!preg.partner_user_id) {
      return { ok: true, message: line + " (No partner is linked yet.)" };
    }
    await notifyPartner(preg, momName + " needs you", String(closed.title) + " — " + line, {
      severity: "request",
      eventType: "PARTNER_WANTED",
      permission: "viewMood",
    });
  }

  // Answering restarts her popup timer, so replying promptly does not mean the
  // next event lands seconds later.
  await db().query(
    `update event_schedules set last_event_at = now(),
       next_event_at = now() + (frequency_minutes * interval '1 minute'), updated_at = now()
      where pregnancy_id = $1`,
    [preg.id],
  );

  return { ok: true, message: line };
}

// ---------------------------------------------------------------------------
// Notifications / journal / partner feed
// ---------------------------------------------------------------------------

async function addJournal(
  userId: string,
  title: string,
  body: string | null,
  kind: "note" | "milestone" | "memory" | "appointment",
  completed = true,
  photoUrl?: string | null,
) {
  await db().query(
    `insert into journal_entries (user_id, title, body, kind, completed, photo_url)
     values ($1, $2, $3, $4, $5, $6)`,
    [userId, title, body, kind, completed, photoUrl || null],
  );
}

const PHOTO_MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);
const PHOTO_MAX_BYTES = 900_000;

export async function saveJournalPhoto(userId: string, mime: string, bytes: Buffer) {
  if (!PHOTO_MIMES.has(mime)) throw new Error("Please upload a JPEG, PNG, or WebP photo.");
  if (!bytes.length || bytes.length > PHOTO_MAX_BYTES) {
    throw new Error("That photo is too large. Try a smaller picture from your PC.");
  }
  const { rows } = await db().query(
    `insert into journal_photos (user_id, mime, bytes) values ($1, $2, $3) returning id`,
    [userId, mime, bytes],
  );
  return rows[0].id as string;
}

export async function loadJournalPhoto(user: HudUser, photoId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(photoId)) return null;
  const { rows } = await db().query(
    `select jp.mime, jp.bytes
       from journal_photos jp
      where jp.id = $1
        and (
          jp.user_id = $2
          or exists (
            select 1 from pregnancies p
             where p.user_id = jp.user_id and p.partner_user_id = $2
          )
        )
      limit 1`,
    [photoId, user.id],
  );
  return (rows[0] as { mime: string; bytes: Buffer } | undefined) ?? null;
}

async function setRecentEmotion(userId: string, emotion: string, rpText?: string) {
  await db().query(
    `insert into user_settings (user_id, settings)
     values ($1, $2::jsonb)
     on conflict (user_id) do update
       set settings = user_settings.settings || $2::jsonb`,
    [
      userId,
      JSON.stringify({
        lastEmotion: emotion,
        lastEmotionRp: rpText ?? null,
        lastEmotionAt: new Date().toISOString(),
      }),
    ],
  );
}

/**
 * Tell the partner something. Gated on the permission Mom controls, so a
 * category she has switched off never reaches their HUD at all — and recorded
 * on the shared event bus so it survives them being offline.
 */
async function notifyPartner(
  preg: { id?: string; user_id?: string; partner_user_id?: string | null },
  title: string,
  body: string,
  options: {
    severity?: EventSeverity;
    eventType?: string;
    permission?: PartnerPermission;
    /**
     * Which "what reaches your partner" toggle governs this message. Distinct
     * from `permission`, which is the consent she granted for an *action*; this
     * is the volume control on what she chooses to broadcast.
     */
    notify?: PartnerNotifyKey;
    actorId?: string | null;
    metadata?: Record<string, unknown>;
  } = {},
) {
  if (!preg.id || !preg.partner_user_id) return;
  if (options.permission && preg.user_id) {
    const perms = await partnerSvc.permissionsForPregnancy(preg.id, preg.user_id);
    if (!perms[options.permission]) return;
  }
  if (options.notify && preg.user_id) {
    const prefs = await preferencesFor(preg.user_id);
    if (!partnerWants(prefs, options.notify)) return;
  }
  await addNotification(preg.partner_user_id, title, body, {
    severity: options.severity ?? "info",
    pregnancyId: preg.id,
    senderId: options.actorId ?? null,
    eventType: options.eventType ?? null,
    metadata: options.metadata,
  });
  await queueCommand(preg.partner_user_id, "partner", "say", { text: title + ": " + body });
}

// ---------------------------------------------------------------------------
// Labor engine wiring
//
// labor.ts decides *what* happened. This turns each transition into the
// wellbeing changes, journal entries and in-world effects the rest of the
// pregnancy system already speaks.
// ---------------------------------------------------------------------------

async function applyLaborTransitions(
  preg: Record<string, any>,
  transitions: LaborTransition[],
): Promise<void> {
  if (!transitions.length) return;
  const momId: string = preg.user_id;
  const momName: string = preg.mom_avatar_name ?? "She";
  const progress = computeProgress(new Date(preg.conceived_at), preg.duration_days);

  for (const t of transitions) {
    if (t.kind === "water") {
      await applyCare(
        momId,
        preg.id,
        "water_break",
        { stress: 12, comfort: -10, hydration: -6 },
        "Water broke",
      );
      await addJournal(momId, "Water broke", "It is really happening.", "milestone");
      await addNotification(momId, "Your water broke", "Ice chips only from here on — no water.", {
        severity: "labor",
        pregnancyId: preg.id,
        eventType: "WATER_BROKE",
      });
      await queueCommand(momId, "hud", "labor_water", {});
      await queueCommand(momId, "hud", "say", { text: "Your water just broke." });
      await publishEvent(preg.id, "WATER_BROKE", "Water broke", {
        severity: "labor",
        body: momName + "'s water has broken.",
        dedupeKey: "water_broke",
      });
      await notifyPartner(preg, "Her water broke", "Ice chips only now — no water.", {
        notify: "labor",
        severity: "labor",
        eventType: "WATER_BROKE",
        permission: "viewLabor",
      });
      await partnerSvc.ensureMilestone(preg.id, "water_broke", "Water broke", {
        week: progress.week,
      });
      continue;
    }

    if (t.kind === "hospital_advised") {
      await addNotification(momId, "Time to go to the hospital", "Labor is established.", {
        severity: "urgent",
        pregnancyId: preg.id,
        eventType: "GO_TO_HOSPITAL",
      });
      await queueCommand(momId, "hud", "say", { text: "It is time to head to the hospital." });
      await notifyPartner(preg, "Time for the hospital", "Labor is established. Get her in.", {
        notify: "labor",
        severity: "urgent",
        eventType: "GO_TO_HOSPITAL",
        permission: "viewLabor",
      });
      continue;
    }

    switch (t.phase) {
      case "prelabor":
        await addNotification(
          momId,
          "Something is starting",
          "Twinges and tightening. Not long now.",
          {
            severity: "labor",
            pregnancyId: preg.id,
            eventType: "LABOR_PHASE_CHANGED",
          },
        );
        await queueCommand(momId, "hud", "say", { text: "A strange tightening low down..." });
        await publishEvent(preg.id, "LABOR_PHASE_CHANGED", "Early signs", {
          severity: "labor",
          body: "Twinges and tightening.",
          dedupeKey: "phase_prelabor",
        });
        break;

      case "early":
        await applyCare(
          momId,
          preg.id,
          "contractions",
          { stress: 8, comfort: -8, energy: -6 },
          "Labor began",
        );
        await addJournal(momId, "Labor started", "Contractions have begun.", "milestone");
        await addNotification(momId, "Labor has started", "Contractions have begun. Breathe.", {
          severity: "labor",
          pregnancyId: preg.id,
          eventType: "LABOR_STARTED",
        });
        await queueCommand(momId, "hud", "labor_contractions", { intensity: 30 });
        await publishEvent(preg.id, "LABOR_STARTED", "Labor started", {
          severity: "labor",
          body: momName + " is in early labor.",
          dedupeKey: "labor_started",
        });
        await notifyPartner(preg, "She is in labor", "Contractions have started. Go to her.", {
          notify: "labor",
          severity: "labor",
          eventType: "LABOR_STARTED",
          permission: "viewLabor",
        });
        await partnerSvc.ensureMilestone(preg.id, "labor_started", "Labor started", {
          week: progress.week,
        });
        break;

      case "active":
        await applyCare(
          momId,
          preg.id,
          "contractions",
          { stress: 10, comfort: -10, energy: -8 },
          "Active labor",
        );
        await queueCommand(momId, "hud", "labor_contractions", { intensity: 60 });
        await publishEvent(preg.id, "LABOR_PHASE_CHANGED", "Active labor", {
          severity: "labor",
          body: momName + " is in active labor.",
          dedupeKey: "phase_active",
        });
        await notifyPartner(
          preg,
          "Contractions are stronger",
          "Active labor. Guide her breathing.",
          {
            severity: "labor",
            eventType: "CONTRACTION_INTENSITY_CHANGED",
            permission: "viewLabor",
          },
        );
        break;

      case "transition":
        await applyCare(
          momId,
          preg.id,
          "contractions",
          { stress: 14, comfort: -12, energy: -10 },
          "Transition",
        );
        await queueCommand(momId, "hud", "labor_contractions", { intensity: 85 });
        await publishEvent(preg.id, "LABOR_PHASE_CHANGED", "Transition", {
          severity: "urgent",
          body: "The hardest part.",
          dedupeKey: "phase_transition",
        });
        await notifyPartner(preg, "Transition — the hardest part", "Stay right beside her.", {
          notify: "labor",
          severity: "urgent",
          eventType: "LABOR_PHASE_CHANGED",
          permission: "viewLabor",
        });
        break;

      case "pushing":
        await queueCommand(momId, "hud", "say", { text: "It is time to push." });
        await addNotification(momId, "Time to push", "Almost there.", {
          severity: "urgent",
          pregnancyId: preg.id,
          eventType: "BIRTH_STARTED",
        });
        await publishEvent(preg.id, "BIRTH_STARTED", "The baby is coming", {
          severity: "urgent",
          body: momName + " is pushing.",
          dedupeKey: "birth_started",
        });
        await notifyPartner(preg, "The baby is coming", "She is pushing. Be there.", {
          notify: "labor",
          severity: "urgent",
          eventType: "BIRTH_STARTED",
          permission: "viewLabor",
        });
        break;

      case "delivered": {
        const baby = preg.baby_name ? preg.baby_name : "the baby";
        await applyCare(
          momId,
          preg.id,
          "birth",
          { mood: 20, stress: -15, comfort: 8, baby_bond: 20, energy: -20 },
          "Birth",
        );
        await addJournal(momId, "Birth", baby + " is here. The family just grew.", "milestone");
        await addNotification(momId, "Congratulations", baby + " has arrived ♥", {
          severity: "birth",
          pregnancyId: preg.id,
          eventType: "BABY_BORN",
        });
        await queueCommand(momId, "hud", "labor_birth", {});
        await queueAnim(momId, "hud", "hearts");
        await queueCommand(momId, "hud", "say", { text: baby + " is here. Congratulations." });
        await publishEvent(preg.id, "BABY_BORN", "Baby born", {
          severity: "birth",
          body: baby + " has arrived.",
          dedupeKey: "baby_born",
        });
        await notifyPartner(preg, "The baby is here", baby + " has arrived ♥", {
          severity: "birth",
          eventType: "BABY_BORN",
          permission: "viewLabor",
        });
        await partnerSvc.ensureMilestone(preg.id, "baby_born", "Baby born", {
          body: baby + " arrived.",
          week: progress.week,
        });
        break;
      }
    }
  }
}

/**
 * Run the labor engine for this pregnancy and apply whatever it decided.
 * Safe to call from any request, by either partner, as often as you like.
 */
export async function tickLabor(preg: Record<string, any>): Promise<Record<string, any>> {
  try {
    const { preg: updated, transitions } = await runLaborEngine(preg as any);
    const merged = { ...preg, ...updated };
    if (transitions.length) await applyLaborTransitions(merged, transitions);
    return merged;
  } catch (error) {
    // The partner layer is supplementary: a labor engine fault must never take
    // the pregnancy HUD down with it.
    console.error("labor engine", error);
    return preg;
  }
}

async function setLaborStage(
  pregnancyId: string,
  stage: "none" | "contractions" | "water_broken" | "hospital" | "birth" | "delivered",
  extra: Record<string, unknown> = {},
) {
  const sets = ["labor_stage = $2", "updated_at = now()"];
  const values: unknown[] = [pregnancyId, stage];
  let i = 3;
  if (stage === "contractions") {
    sets.push(`contractions_started_at = coalesce(contractions_started_at, now())`);
    sets.push(`contraction_intensity = greatest(contraction_intensity, 35)`);
  }
  if (stage === "water_broken") {
    sets.push(`water_broken_at = coalesce(water_broken_at, now())`);
    sets.push(`contraction_intensity = greatest(contraction_intensity, 55)`);
  }
  if (stage === "hospital") sets.push(`hospital_at = coalesce(hospital_at, now())`);
  if (stage === "birth" || stage === "delivered") {
    sets.push(`birth_at = coalesce(birth_at, now())`);
    sets.push(`status = 'delivered'`);
  }
  if (typeof extra.intensity === "number") {
    sets.push(`contraction_intensity = $${i}`);
    values.push(extra.intensity);
    i++;
  }
  await db().query(`update pregnancies set ${sets.join(", ")} where id = $1`, values);
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

async function syncEventSchedule(
  user: HudUser,
  pregnancyId: string,
  setupComplete: boolean,
): Promise<string | null> {
  if (user.role !== "mom") return null;

  if (!setupComplete) {
    await db().query(`delete from event_schedules where pregnancy_id = $1`, [pregnancyId]);
    return null;
  }

  const prefs = await preferencesFor(user.id);
  const frequency = prefs.popupFrequencyMinutes;

  if (frequency === 0 || prefs.popupSurface === "off") {
    await db().query(`delete from event_schedules where pregnancy_id = $1`, [pregnancyId]);
    return null;
  }

  const { rows: scheduled } = await db().query(
    `insert into event_schedules
       (pregnancy_id, user_id, frequency_minutes, next_event_at)
     values ($1, $2, $3::integer, now() + ($3::integer * interval '1 minute'))
     on conflict (pregnancy_id) do update set
       user_id = excluded.user_id,
       frequency_minutes = excluded.frequency_minutes,
       next_event_at = case
         when event_schedules.frequency_minutes <> excluded.frequency_minutes
           then excluded.next_event_at
         else event_schedules.next_event_at
       end,
       updated_at = now()
     returning next_event_at`,
    [pregnancyId, user.id, frequency],
  );

  // Atomically claim a due event. Only one concurrent MOAP refresh can move
  // the timestamp forward and trigger the event.
  const { rows: claimed } = await db().query(
    `update event_schedules
     set last_event_at = now(),
         next_event_at = now() + (frequency_minutes * interval '1 minute'),
         updated_at = now()
     where pregnancy_id = $1 and next_event_at <= now()
     returning next_event_at`,
    [pregnancyId],
  );
  if (claimed[0]) {
    // Roll inline rather than recursing through performAction: this runs inside
    // a dashboard read, and performAction would re-enter the labor engine and
    // the schedule sync it is already inside.
    const preg = await db().query(`select * from pregnancies where id = $1`, [pregnancyId]);
    const row = preg.rows[0];
    if (row) {
      const progress = computeProgress(new Date(row.conceived_at), row.duration_days);
      const stats = await getStatsWithDecay(
        user.id,
        progress.trimester,
        DECAY_MULTIPLIER[prefs.decayPace],
      );
      await rollAndDeliverEvent(
        { ...row, mom_user_id: user.id, mom_avatar_name: user.display_name ?? user.avatar_name },
        user.id,
        user.display_name ?? user.avatar_name,
        stats,
        prefs,
      );
    }
  }

  return String(claimed[0]?.next_event_at ?? scheduled[0].next_event_at);
}

// ---------------------------------------------------------------------------
// Dashboard state
// ---------------------------------------------------------------------------

export async function getDashboardState(user: HudUser) {
  const preg = await pregnancyForUser(user);
  if (!preg) return { error: "no_pregnancy" };

  const momId: string = preg.mom_user_id;
  const delivered = isDeliveredPregnancy(preg);
  const nextEventAt = await syncEventSchedule(
    user,
    preg.id,
    Boolean(preg.setup_complete) && !delivered,
  );
  const progress = computeProgress(new Date(preg.conceived_at), preg.duration_days);
  const milestone = milestoneForWeek(progress.week);
  // Her preferences, not the reader's: decay, event pacing and privacy all
  // belong to the pregnancy, so a partner opening their HUD sees (and causes)
  // exactly what she configured.
  const prefs = await preferencesFor(momId);
  const stats = await getStatsWithDecay(
    momId,
    progress.trimester,
    DECAY_MULTIPLIER[prefs.decayPace],
  );
  const activeEvent = user.role === "mom" ? await activeEventFor(preg.id) : null;

  const [
    symptoms,
    journal,
    activities,
    notifications,
    unreadCount,
    kicks,
    settings,
    supportRow,
    craving,
    events,
    momSettings,
  ] = await Promise.all([
    db().query(`select name, severity from symptoms where pregnancy_id = $1 order by name`, [
      preg.id,
    ]),
    db().query(
      `select id, title, body, kind, completed, entry_date, created_at, photo_url
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
    db().query(`select count(*)::int as n from notifications where user_id = $1 and read = false`, [
      user.id,
    ]),
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
    db().query(`select settings from user_settings where user_id = $1`, [momId]),
  ]);

  // Partner layer. Every piece is independently optional: if any of it fails
  // the pregnancy dashboard still renders, because the partner system is
  // supplementary to the pregnancy system and never load-bearing for it.
  const [bag, milestones, sharedEvents, incoming, outgoing, pendingLinks, permissions] =
    await Promise.all([
      partnerSvc.hospitalBag(preg.id).catch(() => null),
      partnerSvc.milestonesFor(preg.id).catch(() => []),
      recentEvents(preg.id, 25).catch(() => []),
      partnerSvc.pendingRequestsFor(user.id, preg.id).catch(() => []),
      partnerSvc.outgoingRequests(user.id, preg.id).catch(() => []),
      user.role === "mom"
        ? partnerSvc.pendingLinksForMom(preg.id).catch(() => [])
        : Promise.resolve([]),
      partnerSvc.permissionsForPregnancy(preg.id, momId).catch(() => null),
    ]);
  const labor = snapshotOf(preg as any);

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
  const popupFrequencyMinutes = prefs.popupFrequencyMinutes;
  const viewerPrefs = user.id === momId ? prefs : await preferencesFor(user.id);
  const ultrasounds = await ensureUltrasoundUnlocks(preg.id, momId, progress.week);
  const momSettingsJson = (momSettings.rows[0]?.settings ?? {}) as Record<string, unknown>;
  const moodInfo = moodFromKey(
    typeof momSettingsJson.lastEmotion === "string" ? momSettingsJson.lastEmotion : "calm",
  );
  const moodRp =
    (typeof momSettingsJson.lastEmotionRp === "string" && momSettingsJson.lastEmotionRp) ||
    moodInfo.note;
  const contractionStarted = preg.contractions_started_at
    ? new Date(preg.contractions_started_at).getTime()
    : null;
  const contractionMinutes = contractionStarted
    ? Math.max(0, Math.round((Date.now() - contractionStarted) / 60_000))
    : 0;

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
      delivered,
      babyName: preg.baby_name,
      babyGender: preg.baby_gender,
      durationDays: preg.duration_days,
      setupComplete: Boolean(preg.setup_complete || settings.rows[0]?.settings?.setupComplete),
      setupStep: Number(preg.setup_step ?? 1),
      progressionMode: preg.progression_mode ?? "scaled",
      babyCount: Number(preg.baby_count ?? 1),
      babyNames: Array.isArray(preg.baby_names) ? preg.baby_names : [],
      privacyMode: preg.privacy_mode ?? "partner",
      labor: {
        stage: preg.labor_stage ?? "none",
        phase: labor.phase,
        inLabor: labor.inLabor,
        hospitalAdvised: labor.hospitalAdvised,
        minutesToBirth: labor.minutesToBirth,
        intensity: Number(preg.contraction_intensity ?? 0),
        waterBroken: Boolean(preg.water_broken_at),
        atHospital: Boolean(preg.hospital_at),
        contractionMinutes,
        waterBrokenAt: preg.water_broken_at ?? null,
        contractionsStartedAt: preg.contractions_started_at ?? null,
        hospitalAt: preg.hospital_at ?? null,
        birthAt: preg.birth_at ?? null,
      },
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
    mood: {
      key: moodInfo.key,
      label: moodInfo.label,
      emoji: moodInfo.emoji,
      note: moodInfo.note,
      hint: moodRp,
    },
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
      pendingLinks,
      permissions,
    },
    requests: { incoming, outgoing },
    hospitalBag: bag,
    milestones,
    sharedEvents,
    notifications: notifications.rows,
    unread: Number(unreadCount.rows[0].n),
    currentCraving: craving ?? null,
    ultrasounds,
    newUltrasounds: ultrasounds.filter((u) => !u.seen).length,
    foods: FOOD_ITEMS.map(foodSummary),
    recentEvents: events.rows,
    popupFrequencyMinutes,
    nextEventAt,
    activeEvent,
    preferences: viewerPrefs,
    eventCategories: EVENT_CATEGORIES,
    testMode: Boolean(preg.test_mode),
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

// ---------------------------------------------------------------------------
// Partner action gate + effects
// ---------------------------------------------------------------------------

/** Was there a kick recently enough for the partner to still share it? */
async function hasFreshKick(pregnancyId: string): Promise<boolean> {
  const { rows } = await db().query(
    `select 1 from kick_events
      where pregnancy_id = $1 and created_at > now() - ($2::int * interval '1 millisecond')
      limit 1`,
    [pregnancyId, KICK_FRESH_MS],
  );
  return Boolean(rows[0]);
}

/**
 * The one place that decides whether a partner may do a thing right now:
 * permission Mom granted, state the pregnancy is actually in, and whether she
 * wants to be asked first. Returns the reason when the answer is no, so the
 * HUD can say it rather than failing silently.
 */
async function partnerActionGate(
  ctx: partnerSvc.PartnerContext,
  preg: Record<string, any>,
  action: string,
): Promise<{ ok: boolean; message: string; needsConsent: boolean }> {
  const def = PARTNER_ACTIONS[action];
  if (!def) return { ok: false, message: "Unknown action.", needsConsent: false };

  if (!ctx.permissions[def.permission]) {
    return { ok: false, message: def.unavailable, needsConsent: false };
  }

  const labor = snapshotOf(preg as any);
  const delivered = isDeliveredPregnancy(preg);

  switch (def.availability) {
    case "labor":
      if (delivered)
        return { ok: false, message: "Labor is over — she did it.", needsConsent: false };
      if (!labor.inLabor) return { ok: false, message: def.unavailable, needsConsent: false };
      break;
    case "birth":
      if (labor.phase !== "pushing") {
        return { ok: false, message: def.unavailable, needsConsent: false };
      }
      break;
    case "kick":
      if (!(await hasFreshKick(preg.id))) {
        return { ok: false, message: def.unavailable, needsConsent: false };
      }
      break;
    case "delivered":
      if (!delivered) return { ok: false, message: def.unavailable, needsConsent: false };
      break;
  }

  // No water once labor starts — ice chips only.
  if (action === "partner_water" && labor.inLabor) {
    return {
      ok: false,
      message: "No water during labor — offer ice chips instead.",
      needsConsent: false,
    };
  }

  const needsConsent = def.consent && ctx.permissions.autoAccept[action] !== true;
  return { ok: true, message: "", needsConsent };
}

interface PartnerMove {
  deltas: Partial<Record<StatName, number>>;
  activity: string;
  pts: number;
  /** `{a}` = partner, `{m}` = mom. */
  line: string;
  eventType?: string;
  severity?: EventSeverity;
}

const PARTNER_MOVES: Record<string, PartnerMove> = {
  hug: {
    deltas: { mood: 10, comfort: 10 },
    activity: "Gave affection",
    pts: 8,
    line: "{a} wraps {m} in a warm hug.",
  },
  kiss: {
    deltas: { mood: 12, comfort: 8, stress: -4 },
    activity: "Shared a kiss",
    pts: 8,
    line: "{a} kisses {m} softly.",
  },
  feel_baby_kick: {
    deltas: { mood: 8, baby_bond: 10 },
    activity: "Felt the baby kick",
    pts: 10,
    line: "{a} rests a hand on the bump and feels the baby move.",
    eventType: "BABY_KICKED",
  },
  partner_comfort: {
    deltas: { comfort: 14, mood: 8, stress: -6 },
    activity: "Comforted mom",
    pts: 8,
    line: "{a} comforts {m}.",
  },
  partner_check_on: {
    deltas: { mood: 5, comfort: 4 },
    activity: "Checked on mom",
    pts: 5,
    line: '{a} checks in: "How are you feeling?"',
  },
  partner_ice_chips: {
    deltas: { hydration: 10, comfort: 8, sickness: -4 },
    activity: "Brought ice chips",
    pts: 6,
    line: "{a} offers {m} ice chips.",
  },
  partner_help_rest: {
    deltas: { rest: 12, energy: 8, comfort: 6, stress: -5 },
    activity: "Helped mom rest",
    pts: 7,
    line: "{a} helps {m} rest.",
  },
  partner_medicine: {
    deltas: { vitamins: 18, sickness: -12, comfort: 5 },
    activity: "Brought vitamins",
    pts: 6,
    line: "{a} brings {m} her prenatal vitamins.",
  },
  partner_water: {
    deltas: { hydration: 20 },
    activity: "Brought a glass of water",
    pts: 5,
    line: "{a} brings {m} a glass of water.",
  },
  partner_backrub: {
    deltas: { comfort: 20, mood: 8 },
    activity: "Gave a back rub",
    pts: 7,
    line: "{a} gives {m} a gentle back rub.",
  },
  partner_labor_support: {
    deltas: { comfort: 10, mood: 8, stress: -10 },
    activity: "Held her hand through a contraction",
    pts: 12,
    line: "{a} holds {m}'s hand through the wave.",
    severity: "labor",
  },
  partner_breathing: {
    deltas: { stress: -12, mood: 6, comfort: 6 },
    activity: "Guided breathing",
    pts: 8,
    line: "{a} breathes with {m}. In... and out.",
    severity: "labor",
  },
  partner_stay_strong: {
    deltas: { mood: 10, comfort: 8, stress: -8 },
    activity: "Stayed calm",
    pts: 10,
    line: "{a} stays steady: \"I've got you. We're okay.\"",
    severity: "labor",
  },
  partner_celebrate: {
    deltas: { mood: 12, baby_bond: 6 },
    activity: "Celebrated a milestone",
    pts: 8,
    line: "{a} celebrates with {m}.",
    severity: "milestone",
  },
  partner_faint: {
    deltas: { mood: 2 },
    activity: "Got dizzy and needed a moment",
    pts: 2,
    line: "{a} goes pale and sits down hard. Still here.",
  },
  partner_vomit_react: {
    deltas: { mood: 1 },
    activity: "Got queasy in the delivery room",
    pts: 2,
    line: "{a} looks a little green... then steadies.",
  },
};

/** Land an approved partner action. Called directly, or after Mom accepts. */
async function applyPartnerMove(
  preg: Record<string, any>,
  partnerUser: HudUser,
  action: string,
  actorName: string,
  momName: string,
): Promise<ActionResult> {
  const move = PARTNER_MOVES[action];
  if (!move) return { ok: false, message: "Unknown action." };
  const momId: string = preg.user_id ?? preg.mom_user_id;
  const line = move.line.replace(/\{a\}/g, actorName).replace(/\{m\}/g, momName);

  await bumpStats(momId, move.deltas);
  await addPartnerActivity(preg.id, actorName, move.activity, move.pts);
  await addNotification(momId, move.activity, line, {
    severity: move.severity ?? "info",
    pregnancyId: preg.id,
    senderId: partnerUser.id,
  });
  await publishEvent(preg.id, move.eventType ?? "PARTNER_SUPPORT", move.activity, {
    severity: move.severity ?? "info",
    body: line,
    actorId: partnerUser.id,
    metadata: { action },
  });

  // Reactions play on the partner's own HUD; everything else reaches hers.
  if (action === "partner_faint" || action === "partner_vomit_react") {
    await queueCommand(
      partnerUser.id,
      "partner",
      action === "partner_faint" ? "faint" : "vomit",
      {},
    );
    await queueCommand(momId, "hud", "say", { text: line });
  } else if (action === "hug" || action === "kiss" || action === "partner_stay_strong") {
    await queueAnim(momId, "hud", "hearts");
    await queueCommand(momId, "hud", "say", { text: line });
  } else if (action === "feel_baby_kick") {
    await queueCommand(momId, "belly", "kick", {});
    await queueCommand(momId, "hud", "say", { text: line });
  } else {
    await queueCommand(momId, "hud", "say", { text: line });
  }

  return { ok: true, message: line, anim: action };
}

export interface MomStatusSummary {
  line: string;
  week: number | null;
  day: number | null;
  stage: string | null;
  mood: string | null;
  symptom: string | null;
  lastEvent: string | null;
  labor: string;
  wellbeing: string | null;
}

/**
 * "Check on her" — a safe, summarised status. Only what Mom has permitted, in
 * words rather than raw meter numbers, and never internal state.
 */
async function checkOnMom(
  preg: Record<string, any>,
  permissions: ReturnType<typeof partnerSvc.resolvePermissions> | null,
): Promise<MomStatusSummary> {
  const momId: string = preg.user_id ?? preg.mom_user_id;
  const allow = (key: PartnerPermission) => !permissions || permissions[key];
  const progress = computeProgress(new Date(preg.conceived_at), preg.duration_days);
  const labor = snapshotOf(preg as any);

  const [statsRow, symptomRow, settingsRow, eventRow] = await Promise.all([
    allow("viewWellness") ? getStatsWithDecay(momId, progress.trimester) : Promise.resolve(null),
    allow("viewSymptoms")
      ? db().query(
          `select name, severity from symptoms where pregnancy_id = $1
            order by severity desc limit 1`,
          [preg.id],
        )
      : Promise.resolve(null),
    allow("viewMood")
      ? db().query(`select settings from user_settings where user_id = $1`, [momId])
      : Promise.resolve(null),
    db().query(
      `select title from pregnancy_events where pregnancy_id = $1
        order by created_at desc limit 1`,
      [preg.id],
    ),
  ]);

  const stats = statsRow as Awaited<ReturnType<typeof getStatsWithDecay>> | null;
  const wellbeing = stats
    ? stats.energy > 65 && stats.rest > 60
      ? "Comfortable"
      : stats.energy < 35 || stats.rest < 35
        ? "Worn out"
        : "Managing"
    : null;

  const moodKey = settingsRow?.rows[0]?.settings?.lastEmotion;
  const mood = allow("viewMood")
    ? moodFromKey(typeof moodKey === "string" ? moodKey : "calm").label
    : null;
  const topSymptom = symptomRow?.rows[0];
  const symptom =
    topSymptom && Number(topSymptom.severity) > 5
      ? `${topSymptom.name} (${severityLabel(Number(topSymptom.severity))})`
      : null;

  const laborText = isDeliveredPregnancy(preg)
    ? "Delivered ♥"
    : labor.inLabor
      ? `${labor.phase === "pushing" ? "Pushing" : "In labor"} · ${labor.intensity}%`
      : labor.phase === "prelabor"
        ? "Early signs"
        : "Not active";

  const parts: string[] = [];
  if (allow("viewWeek")) parts.push(`Week ${progress.week}+${progress.day}`);
  if (mood) parts.push(`Mood: ${mood}`);
  if (wellbeing) parts.push(wellbeing);
  if (symptom) parts.push(symptom);
  if (allow("viewLabor")) parts.push(`Labor: ${laborText}`);

  return {
    line: parts.length ? parts.join(" · ") : "She has kept the details private.",
    week: allow("viewWeek") ? progress.week : null,
    day: allow("viewWeek") ? progress.day : null,
    stage: allow("viewStage")
      ? progress.trimester === 1
        ? "1st Trimester"
        : progress.trimester === 2
          ? "2nd Trimester"
          : "3rd Trimester"
      : null,
    mood,
    symptom,
    lastEvent: (eventRow.rows[0]?.title as string) ?? null,
    labor: allow("viewLabor") ? laborText : "Private",
    wellbeing,
  };
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

  // Actions a partner may call that predate the gated block above still have to
  // respect the permissions she set. Never trust the client to have hidden the
  // button — check the link here too.
  if (isPartner) {
    const LEGACY_PARTNER_PERMISSION: Record<string, PartnerPermission> = {
      support: "allowComfort",
      partner_message: "allowComfort",
      partner_appointment: "viewAppointments",
      partner_status: "allowComfort",
      bag_item: "allowHospitalBag",
      bag_rez: "allowHospitalBag",
      milestone_celebrate: "viewMilestones",
    };
    const needed = LEGACY_PARTNER_PERMISSION[action];
    if (needed) {
      const perms = await partnerSvc.permissionsForPregnancy(preg.id, momId);
      if (!perms[needed]) {
        return { ok: false, message: "She has turned that off in her privacy settings." };
      }
    }
  }

  await db().query(
    `insert into action_log (user_id, action, source, payload) values ($1, $2, $3, $4)`,
    [user.id, action, source, JSON.stringify(params)],
  );

  const str = (k: string, max = 500) =>
    typeof params[k] === "string" ? (params[k] as string).slice(0, max).trim() : "";
  const numberParam = (k: string, fallback: number, min: number, max: number) => {
    const value = Number(params[k]);
    return Number.isFinite(value) ? Math.max(min, Math.min(max, Math.round(value))) : fallback;
  };
  const actionProgress = computeProgress(new Date(preg.conceived_at), preg.duration_days);
  const stats = await getStatsWithDecay(momId, actionProgress.trimester);
  const actionLabor = snapshotOf(preg as any);

  switch (action) {
    // ---- setup / pregnancy controls ---------------------------------------
    case "setup_update": {
      const displayName = str("momName", 80);
      const week = numberParam("week", 1, 1, 40);
      const day = numberParam("day", 0, 0, 6);
      const babyCount = numberParam("babyCount", 1, 1, 3);
      const babyGender = str("babyGender", 20);
      const babyNames = Array.isArray(params.babyNames)
        ? params.babyNames
            .filter((n) => typeof n === "string")
            .map((n) => n.slice(0, 60).trim())
            .filter(Boolean)
        : [];
      const privacyMode = str("privacyMode", 20) || "partner";
      const popupFrequency = numberParam("popupFrequencyMinutes", 20, 0, 240);
      // "week 24" means 24 completed weeks, matching the dashboard display
      const elapsedDays = Math.max(0, Math.min(280, week * 7 + day));
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
      await queueChime(momId);
      return { ok: true, message: "Profile saved. Your Nestoria journey has begun." };
    }

    case "update_week": {
      const week = numberParam("week", 1, 0, 40);
      const day = numberParam("day", 0, 0, 6);
      const elapsedDays = Math.max(0, Math.min(280, week * 7 + day));
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
      await queueAnim(momId, "hud", "belly_hold");
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
      await queueAnim(momId, "hud", "belly_hold");
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
    case "drink_water": {
      // No water once labor starts — ice chips only. The partner's "bring
      // water" already refused here; hers has to as well, or the rule is
      // decoration.
      if (actionLabor.inLabor) {
        return {
          ok: false,
          message: "No water during labor — ice chips only. Try Ice chips instead.",
        };
      }
      await applyCare(
        momId,
        preg.id,
        action,
        { hydration: 25, bladder: -10, baby_wellness: 2 },
        "Drank water",
      );
      await queueAnim(momId, "hud", "drink");
      await queueCommand(momId, "hud", "say", {
        text: "You sip some refreshing water. Hydration +25.",
      });
      return { ok: true, message: "You drink some water. Hydration restored." };
    }

    /**
     * Ice chips: the one thing she may have during labor, and a perfectly
     * ordinary cold drink the rest of the time. Its own action rather than a
     * food_eat parameter so the Care screen can offer it as a button and swap
     * it in for Water once labor begins.
     */
    case "ice_chips": {
      const chips = foodByKey("ice_chips") ?? FOOD_ITEMS[0];
      await applyCare(momId, preg.id, "ice_chips", chips.deltas, "Ice chips");
      await queueAnim(momId, "hud", "drink");
      await queueCommand(momId, "hud", "say", {
        text: actionLabor.inLabor
          ? `${momName} crunches a mouthful of ice chips between contractions.`
          : `${momName} crunches some cold ice chips.`,
      });
      return { ok: true, message: "Cool and welcome. Ice chips it is." };
    }

    case "eat":
    case "food_eat": {
      const food = foodByKey(str("food", 80)) ?? foodByKey(str("foodKey", 80)) ?? FOOD_ITEMS[0];
      await applyCare(momId, preg.id, "eat", food.deltas, `Ate ${food.name}`);
      const nextSickness = clamp(stats.sickness + (food.deltas.sickness ?? 0));
      let extra = "";
      if (nextSickness >= 75 || (stats.sickness >= 55 && (food.deltas.sickness ?? 0) > 0)) {
        extra = " A wave of nausea follows — vomiting is available on Care.";
        await addNotification(momId, "Nausea after eating", extra.trim());
        await setRecentEmotion(momId, "overwhelmed", rpLineFor("overwhelmed"));
      }
      if (food.category === "pica") {
        await addJournal(
          momId,
          `Pica craving: ${food.name}`,
          `${actorName} gave in to a pica craving. Nutrition dipped.`,
          "note",
        );
      }
      await queueCommand(momId, "hud", "say", {
        text: `${actorName} eats ${food.name}. ${food.note}${extra}`,
      });
      return { ok: true, message: `${food.name} eaten. ${food.note}${extra}` };
    }
    case "rest":
      await applyCare(
        momId,
        preg.id,
        action,
        { energy: 30, rest: 30, comfort: 10, sickness: -3, stress: -5 },
        "Rested",
      );
      await queueAnim(momId, "hud", "rest");
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
      await queueAnim(momId, "hud", "vitamins");
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
        await queueChime(momId);
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
        `Craving: ${craving.craving}`,
        `${momName} is craving ${craving.craving}.`,
        undefined,
        "craving",
      );
      const cravingPrefs = await preferencesFor(momId);
      // Same "key|Short label" contract the event roller uses, so the blue menu
      // is built the same way for cravings as for everything else.
      const cravingChoices = [
        ["eat", "Eat it"],
        ["healthy", "Healthy swap"],
        ["ask_partner", "Ask partner"],
        ["journal", "Journal it"],
        ["ignore", "Push through"],
      ];
      if (cravingPrefs.popupSurface === "both" || cravingPrefs.popupSurface === "world") {
        await queueCommand(momId, "hud", "dialog", {
          kind: "craving",
          eventType: "craving",
          title: `Craving: ${craving.craving}`,
          body: `${momName} is craving ${craving.craving}. Intensity ${craving.intensity}%.`,
          choices: cravingChoices.map(([k, l]) => `${k}|${l}`).join(";"),
        });
      }
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
      const sweetPenalty =
        food.category === "desserts" && Number(craving.sweets_streak) >= 2 ? -3 : 0;
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
           sweets_streak = case when $2 = 'desserts' then sweets_streak + 1 else 0 end,
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
      // Her moments are hers. A partner reacts to them; they never cause one.
      if (isPartner) return { ok: false, message: "Only she can do that." };
      if (isDeliveredPregnancy(preg)) {
        return {
          ok: true,
          message: "This pregnancy is marked delivered. Care events have paused.",
        };
      }
      const prefs = await preferencesFor(momId);
      const rolled = await rollAndDeliverEvent(preg, momId, momName, stats, prefs);
      if (!rolled) {
        const open = await activeEventFor(preg.id);
        if (open) {
          return {
            ok: true,
            message: `${open.title} — you have not answered this one yet.`,
            event: { eventType: open.key, title: open.title, body: open.body },
          };
        }
        return {
          ok: false,
          message:
            "Nothing to feel right now — check which event types are switched on in Settings.",
        };
      }
      return {
        ok: true,
        message: `${rolled.event.title}: ${rolled.event.body}`,
        event: {
          eventType: rolled.event.key,
          title: rolled.event.title,
          body: rolled.event.body,
        },
      };
    }

    case "random_event_choice":
    case "event_choice": {
      if (isPartner) return { ok: false, message: "Only she can answer that." };
      const prefs = await preferencesFor(momId);
      const choice = str("choice", 40);
      const eventId = str("eventId", 40);
      if (!choice) return { ok: false, message: "Pick one of the options." };
      return answerEvent(preg, momId, momName, choice, prefs, eventId || undefined);
    }

    case "event_dismiss": {
      if (isPartner) return { ok: false, message: "Only she can answer that." };
      const { rows } = await db().query(
        `update event_history set answered_at = now(), choice = 'dismissed'
          where pregnancy_id = $1 and answered_at is null returning id`,
        [preg.id],
      );
      if (!rows[0]) return { ok: true, message: "Nothing open right now." };
      await db().query(
        `update event_schedules set last_event_at = now(),
           next_event_at = now() + (frequency_minutes * interval '1 minute'), updated_at = now()
          where pregnancy_id = $1`,
        [preg.id],
      );
      return { ok: true, message: "Let it pass." };
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
      await queueCommand(momId, "hud", bpm > 0 ? "heartbeat" : "say", {
        text: `[Check-up] ${heartLine}`,
      });
      return { ok: true, message: `Check-up done. ${heartLine}` };
    }

    case "kick": {
      await db().query(`insert into kick_events (pregnancy_id, source) values ($1, $2)`, [
        preg.id,
        source === "sl" ? "belly" : "web",
      ]);
      if (source !== "sl") await queueCommand(momId, "belly", "kick", {});
      await queueAnim(momId, "hud", "kick", { text: "Baby is kicking!" });
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
      await queueChime(momId);
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
      const photoId = str("photoId", 40);
      const photoUrl = /^[0-9a-f-]{36}$/i.test(photoId)
        ? `/api/hud/photo?id=${photoId}`
        : str("photoUrl", 300) || null;
      await addJournal(
        momId,
        title,
        str("body", 2000) || null,
        kind,
        kind !== "appointment",
        photoUrl,
      );
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
      const severity = numberParam("severity", 0, 0, 100);
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
        const d = numberParam("durationDays", Number(preg.duration_days), 1, 280);
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
      // Preferences. Anything the client sends is normalized against the
      // currently-stored value first, so a patch from one Settings tab cannot
      // blank the tabs it did not render, and an invalid value is replaced with
      // her existing one rather than a default.
      const prefPatch =
        params.preferences && typeof params.preferences === "object"
          ? (params.preferences as Record<string, unknown>)
          : typeof params.settings === "object" && params.settings !== null
            ? (params.settings as Record<string, unknown>)
            : null;
      if (prefPatch) {
        // testMode is never settable from a plain settings save — it has its
        // own code-gated action.
        const { testMode: _ignored, ...safe } = prefPatch;
        const current = await preferencesFor(user.id);
        const merged = normalizePreferences({ ...current, ...safe }, current);
        await db().query(
          `insert into user_settings (user_id, settings) values ($1, $2::jsonb)
           on conflict (user_id) do update set settings = user_settings.settings || $2::jsonb`,
          [user.id, JSON.stringify(merged)],
        );
        if (user.role === "mom") {
          // Privacy mode is duplicated on the pregnancy row because partner
          // queries read it there.
          await db().query(
            `update pregnancies set privacy_mode = $2, updated_at = now() where id = $1`,
            [preg.id, merged.privacyMode],
          );
        }
      }
      return { ok: true, message: "Settings saved ✓" };
    }

    // ---- test mode (code-gated) -------------------------------------------
    case "test_unlock": {
      if (user.role !== "mom") return { ok: false, message: "Only the wearer can do that." };
      const code = str("code", 60).toLowerCase();
      if (code !== testCode().toLowerCase()) {
        return { ok: false, message: "That code is not right." };
      }
      await db().query(
        `update pregnancies set test_mode = true, updated_at = now() where id = $1`,
        [preg.id],
      );
      await savePreferences(momId, { testMode: true });
      return { ok: true, message: "Test mode unlocked. The test panel is now in Settings." };
    }

    case "test_lock": {
      if (user.role !== "mom") return { ok: false, message: "Only the wearer can do that." };
      // Put the real labor plan back before locking, so a tested pregnancy is
      // not left running at 25x for the rest of its life.
      await db().query(
        `update pregnancies
            set test_mode = false,
                labor_plan = coalesce(labor_plan_backup, labor_plan),
                labor_onset_frac = coalesce(labor_onset_backup, labor_onset_frac),
                labor_plan_backup = null,
                labor_onset_backup = null,
                updated_at = now()
          where id = $1`,
        [preg.id],
      );
      await savePreferences(momId, { testMode: false });
      return { ok: true, message: "Test mode off. Real labor timing restored." };
    }

    case "test_jump_week": {
      const blocked = await requireTestMode(preg, user);
      if (blocked) return { ok: false, message: blocked };
      const week = numberParam("week", 20, 1, 42);
      const day = numberParam("day", 0, 0, 6);
      // conceived_at is the clock. Moving it moves the whole pregnancy, which
      // is exactly what "jump to week N" means — labor onset is stored as a
      // fraction, so it stays at the same gestational point.
      const durationDays = Number(preg.duration_days);
      const frac = Math.min(0.999, (week - 1 + day / 7) / 40);
      const conceived = new Date(Date.now() - frac * durationDays * 86_400_000);
      await db().query(
        `update pregnancies set conceived_at = $2, updated_at = now() where id = $1`,
        [preg.id, conceived.toISOString()],
      );
      return { ok: true, message: `Jumped to week ${week} + ${day}d.` };
    }

    case "test_force_labor": {
      const blocked = await requireTestMode(preg, user);
      if (blocked) return { ok: false, message: blocked };
      await backupLaborPlan(preg.id);
      const durationDays = Number(preg.duration_days);
      const elapsed =
        (Date.now() - new Date(preg.conceived_at).getTime()) / (durationDays * 86_400_000);
      // Onset a hair in the past puts her at minute zero of early labor on the
      // very next engine tick.
      await db().query(
        `update pregnancies
            set labor_onset_frac = $2,
                labor_phase = 'none',
                labor_stage = 'none',
                contraction_intensity = 0,
                water_broken_at = null,
                contractions_started_at = null,
                hospital_at = null,
                birth_at = null,
                status = 'active',
                updated_at = now()
          where id = $1`,
        [preg.id, Math.max(0, elapsed - 0.0000001)],
      );
      return { ok: true, message: "Labor will start on the next refresh." };
    }

    case "test_labor_speed": {
      const blocked = await requireTestMode(preg, user);
      if (blocked) return { ok: false, message: blocked };
      const speed = numberParam("speed", 1, 1, 120);
      await backupLaborPlan(preg.id);
      const { rows } = await db().query(
        `select coalesce(labor_plan_backup, labor_plan) as plan from pregnancies where id = $1`,
        [preg.id],
      );
      const base = rows[0]?.plan;
      if (!base || base.v !== 1) {
        return { ok: false, message: "No labor plan drawn yet — open the HUD once first." };
      }
      const scale = (n: number) => Math.max(1, Math.round(Number(n) / speed));
      const scaled = {
        v: 1,
        totalMinutes: scale(base.totalMinutes),
        waterAt: Math.max(0, Math.round(Number(base.waterAt) / speed)),
        hospitalAt: Math.max(0, Math.round(Number(base.hospitalAt) / speed)),
        active: scale(base.active),
        transition: scale(base.transition),
        pushing: scale(base.pushing),
      };
      await db().query(
        `update pregnancies set labor_plan = $2::jsonb, updated_at = now() where id = $1`,
        [preg.id, JSON.stringify(scaled)],
      );
      return {
        ok: true,
        message: `Labor speed ${speed}x — full labor now runs about ${scaled.totalMinutes} minutes.`,
      };
    }

    case "test_reset_labor": {
      const blocked = await requireTestMode(preg, user);
      if (blocked) return { ok: false, message: blocked };
      await db().query(
        `update pregnancies
            set labor_phase = 'none',
                labor_stage = 'none',
                contraction_intensity = 0,
                water_broken_at = null,
                contractions_started_at = null,
                hospital_at = null,
                birth_at = null,
                status = 'active',
                labor_plan = coalesce(labor_plan_backup, labor_plan),
                labor_onset_frac = coalesce(labor_onset_backup, labor_onset_frac),
                labor_plan_backup = null,
                labor_onset_backup = null,
                updated_at = now()
          where id = $1`,
        [preg.id],
      );
      await db().query(
        `delete from pregnancy_events where pregnancy_id = $1 and dedupe_key is not null`,
        [preg.id],
      );
      return { ok: true, message: "Labor reset. The pregnancy is active again." };
    }

    case "notifications_read":
      await db().query(`update notifications set read = true where user_id = $1`, [user.id]);
      return { ok: true, message: "Notifications marked as read." };

    // ---- vision board: care, labor, bag, partner support --------------------
    case "sleep":
      await applyCare(
        momId,
        preg.id,
        action,
        { energy: 45, rest: 40, comfort: 12, sickness: -6, stress: -10, mood: 6 },
        "Slept",
      );
      await setRecentEmotion(momId, "sleepy", rpLineFor("sleepy"));
      await queueAnim(momId, "hud", "sleep");
      await queueCommand(momId, "hud", "say", {
        text: `${actorName} curls up and sleeps. Energy and rest restore.`,
      });
      return { ok: true, message: "You sleep. Energy +45, rest restored." };

    case "vomit":
      await applyCare(
        momId,
        preg.id,
        action,
        { sickness: -22, hunger: -10, hydration: -12, comfort: -6, mood: -4, stress: 3 },
        "Vomited",
      );
      await setRecentEmotion(momId, "overwhelmed", rpLineFor("overwhelmed"));
      await queueAnim(momId, "hud", "vomit");
      await queueCommand(momId, "hud", "say", {
        text: `${actorName} is sick. Nausea eases a little, but she needs water and rest.`,
      });
      await notifyPartner(
        preg,
        `${momName} is feeling sick`,
        "She just had a vomiting spell. Water, a cold cloth, or a check-in would help.",
      );
      return { ok: true, message: "Vomiting logged. Sickness eased. Please drink water." };

    case "cry":
      await applyCare(
        momId,
        preg.id,
        action,
        { mood: -6, stress: -8, comfort: 4, energy: -3 },
        "Cried",
      );
      await setRecentEmotion(momId, "crying", rpLineFor("crying"));
      await queueAnim(momId, "hud", "cry");
      await queueCommand(momId, "hud", "say", {
        text: `${actorName} lets herself cry. Stress softens a little.`,
      });
      await notifyPartner(
        preg,
        `${momName} is crying`,
        "She could use comfort, a hug, or a check-in.",
      );
      return { ok: true, message: "You let it out. Stress eased. Partner was notified." };

    case "feel_kick":
      await db().query(`insert into kick_events (pregnancy_id, source) values ($1, $2)`, [
        preg.id,
        source === "sl" ? "belly" : "web",
      ]);
      await applyCare(
        momId,
        preg.id,
        action,
        { mood: 6, baby_bond: 4, baby_movement: 8 },
        "Felt a kick",
      );
      await queueCommand(momId, "belly", "kick", {});
      await queueAnim(momId, "hud", "kick", { text: "Baby is kicking!" });
      await publishEvent(preg.id, "BABY_KICKED", "Baby kicked", {
        severity: "info",
        body: momName + " felt the baby kick.",
        metadata: { at: new Date().toISOString() },
      });
      await notifyPartner(
        preg,
        "Baby is kicking 💕",
        momName + " felt the baby kick. Want to feel?",
        {
          eventType: "BABY_KICKED",
          permission: "viewKicks",
        },
      );
      await partnerSvc.ensureMilestone(preg.id, "first_kick", "First kick", {
        body: "The first flutter you could really feel.",
      });
      return { ok: true, message: "Baby kick felt. Your partner can share the moment." };

    case "count_kick":
      await db().query(`insert into kick_events (pregnancy_id, source) values ($1, 'web')`, [
        preg.id,
      ]);
      await applyCare(momId, preg.id, action, { baby_movement: 5, baby_bond: 2 }, "Counted a kick");
      return { ok: true, message: "Kick counted for today's session." };

    // Labor is owned by the engine (labor.ts). There is deliberately no
    // water_break or birth action any more — reaching term causes those, and
    // both HUDs find out together. What is left here are the two things that
    // are genuinely a player's choice during labor.

    case "contractions": {
      const labor = snapshotOf(preg as any);
      if (!labor.inLabor) {
        return { ok: false, message: "You are not in labor yet. Your body will tell you." };
      }
      await applyCare(
        momId,
        preg.id,
        action,
        { stress: 6, comfort: -6, energy: -4 },
        "Breathed through a contraction",
      );
      await queueCommand(momId, "hud", "labor_contractions", { intensity: labor.intensity });
      await notifyPartner(
        preg,
        "A contraction",
        `Intensity ${labor.intensity}%. Breathe with her.`,
        {
          severity: "labor",
          eventType: "CONTRACTION_STARTED",
          permission: "viewLabor",
        },
      );
      return {
        ok: true,
        message: `You breathe through it. Intensity ${labor.intensity}%.`,
        intensity: labor.intensity,
      };
    }

    case "go_to_hospital": {
      const labor = snapshotOf(preg as any);
      if (!labor.inLabor) {
        return { ok: false, message: "There is no need to go anywhere yet." };
      }
      if (preg.hospital_at) return { ok: true, message: "You are already at the hospital." };
      await db().query(
        `update pregnancies
            set hospital_at = coalesce(hospital_at, now()),
                labor_stage = $2, updated_at = now()
          where id = $1`,
        [
          preg.id,
          laborStageFor({
            phase: labor.phase as any,
            waterBroken: labor.waterBroken,
            atHospital: true,
          }),
        ],
      );
      await applyCare(momId, preg.id, action, { stress: -4, comfort: 4 }, "Went to hospital");
      await addJournal(
        momId,
        "Arrived at the hospital",
        "The next chapter is starting.",
        "milestone",
      );
      await queueCommand(momId, "hud", "rez_bed", {});
      await publishEvent(preg.id, "HOSPITAL_ARRIVED", "At the hospital", {
        severity: "labor",
        body: momName + " has arrived at the hospital.",
        dedupeKey: "hospital_arrived",
      });
      await partnerSvc.ensureMilestone(preg.id, "hospital_arrival", "Hospital arrival");
      await notifyPartner(preg, "She is at the hospital", "Meet her at the bed.", {
        severity: "urgent",
        eventType: "HOSPITAL_ARRIVED",
        permission: "viewLabor",
      });
      return { ok: true, message: "Hospital scene started. Sit the bed if it is out." };
    }

    case "pack_bag":
      await queueCommand(momId, "hud", "bag_pack", {});
      await notifyPartner(
        preg,
        "Packing the hospital bag",
        `${momName} is packing the worn hospital bag. You can help if you are close.`,
      );
      return {
        ok: true,
        message: "The worn hospital bag should open to pack. Wear the bag first.",
      };

    case "pack_bag_complete":
      await applyCare(
        momId,
        preg.id,
        action,
        { stress: -6, comfort: 6, mood: 4 },
        "Packed the hospital bag",
      );
      await addJournal(
        momId,
        "Hospital bag packed",
        `${actorName} packed the hospital bag in-world.`,
        "memory",
      );
      await notifyPartner(preg, "Bag is packed", "The hospital bag is ready.");
      return { ok: true, message: "The hospital bag is packed and ready." };

    // ---- partner support --------------------------------------------------
    //
    // Every partner move funnels through one gate: does the link exist, has Mom
    // allowed this category, is the pregnancy in a state where it makes sense,
    // and does she want to be asked first? Only then does the effect land.
    case "hug":
    case "kiss":
    case "feel_baby_kick":
    case "partner_comfort":
    case "partner_check_on":
    case "partner_ice_chips":
    case "partner_help_rest":
    case "partner_medicine":
    case "partner_water":
    case "partner_backrub":
    case "partner_labor_support":
    case "partner_breathing":
    case "partner_celebrate":
    case "partner_stay_strong":
    case "partner_faint":
    case "partner_vomit_react": {
      // Mom pressing "hug" is hugging her own bump, not a partner interaction.
      if (!isPartner && action === "hug") {
        await bumpStats(momId, { mood: 10, comfort: 10 });
        await queueAnim(momId, "hud", "hearts");
        await queueCommand(momId, "belly", "say", { text: "Baby feels the love." });
        await addNotification(momId, "Self care ♥", "You took a moment for yourself and baby.");
        return { ok: true, message: "You wrap your arms around your bump ♥" };
      }
      if (!isPartner) {
        return { ok: false, message: "That is a Partner HUD action." };
      }

      const ctx = await partnerSvc.partnerContext(user);
      if (!ctx) return { ok: false, message: "You are not linked to a pregnancy." };

      const gate = await partnerActionGate(ctx, preg, action);
      if (!gate.ok) return { ok: false, message: gate.message };

      if (gate.needsConsent) {
        return await partnerSvc.createInteractionRequest({
          pregnancyId: preg.id,
          senderId: user.id,
          senderName: actorName,
          recipientId: momId,
          actionType: action,
          payload: { note: str("note", 160) },
        });
      }
      return await applyPartnerMove(preg, user, action, actorName, momName);
    }

    // Mom answers a partner request.
    case "request_respond": {
      const requestId = str("requestId", 64);
      const accept = params.accept === true || params.accept === "true";
      if (!/^[0-9a-f-]{36}$/i.test(requestId)) {
        return { ok: false, message: "That request is no longer waiting." };
      }
      const claimed = await partnerSvc.claimRequest(
        requestId,
        user.id,
        accept ? "accepted" : "declined",
      );
      if (!claimed) return { ok: false, message: "That request already expired or was answered." };

      const def = PARTNER_ACTIONS[claimed.action_type as string];
      const senderRow = await db().query(
        `select id, avatar_name, display_name, avatar_key, role from hud_users where id = $1`,
        [claimed.sender_id],
      );
      const sender = senderRow.rows[0] as HudUser | undefined;
      const senderName = sender ? (sender.display_name ?? sender.avatar_name) : "Your partner";

      if (!accept) {
        await addNotification(
          claimed.sender_id,
          "Not right now",
          `${momName} declined: ${def?.label ?? claimed.action_type}.`,
          {
            severity: "info",
            pregnancyId: preg.id,
          },
        );
        await queueCommand(claimed.sender_id, "partner", "say", { text: "Not right now ♥" });
        return { ok: true, message: "Declined." };
      }

      const result = sender
        ? await applyPartnerMove(preg, sender, claimed.action_type as string, senderName, momName)
        : { ok: false, message: "That partner is no longer linked." };
      await addNotification(
        claimed.sender_id,
        "She said yes ♥",
        def?.label ?? claimed.action_type,
        {
          severity: "info",
          pregnancyId: preg.id,
        },
      );
      await queueCommand(claimed.sender_id, "partner", "hearts", {});
      return {
        ok: result.ok,
        message: result.ok ? `${senderName}: ${def?.label ?? "done"} ♥` : result.message,
      };
    }

    case "request_cancel": {
      const requestId = str("requestId", 64);
      if (!/^[0-9a-f-]{36}$/i.test(requestId)) return { ok: false, message: "Unknown request." };
      const cancelled = await partnerSvc.cancelRequestBySender(requestId, user.id);
      return cancelled
        ? { ok: true, message: "Withdrawn." }
        : { ok: false, message: "Nothing to withdraw." };
    }

    // ---- partner linking (Mom's side) --------------------------------------
    case "partner_link_respond": {
      if (isPartner) return { ok: false, message: "Only she can answer that." };
      const linkId = str("linkId", 64);
      if (!/^[0-9a-f-]{36}$/i.test(linkId)) return { ok: false, message: "Unknown request." };
      return await partnerSvc.respondToLink(
        user,
        preg.id,
        linkId,
        params.accept === true || params.accept === "true",
      );
    }

    case "partner_remove": {
      if (isPartner) return { ok: false, message: "Only she can remove the link." };
      return await partnerSvc.removePartner(preg.id, user.id);
    }

    case "partner_permissions": {
      if (isPartner) return { ok: false, message: "Only she can change these." };
      const patch =
        typeof params.permissions === "object" && params.permissions !== null
          ? (params.permissions as Record<string, unknown>)
          : {};
      await partnerSvc.updateLinkPermissions(preg.id, patch);
      return { ok: true, message: "Privacy settings saved ✓" };
    }

    // ---- shared hospital bag ------------------------------------------------
    case "bag_item": {
      if (isPartner) {
        const ctx = await partnerSvc.partnerContext(user);
        if (!ctx) return { ok: false, message: "You are not linked to a pregnancy." };
        if (!ctx.permissions.allowHospitalBag) {
          return { ok: false, message: PARTNER_ACTIONS.partner_celebrate.unavailable };
        }
      }
      const result = await partnerSvc.setBagItem({
        pregnancyId: preg.id,
        itemKey: str("itemKey", 64),
        checked: params.checked === true || params.checked === "true",
        userId: user.id,
        userName: actorName,
      });
      if (result.changed && isPartner) {
        await addPartnerActivity(preg.id, actorName, "Packed the hospital bag", 3);
      }
      return { ok: result.ok, message: result.message };
    }

    case "bag_rez":
      await queueCommand(momId, "hud", "bag_pack", {});
      return { ok: true, message: "The worn hospital bag should open to pack." };

    // ---- shared milestones ---------------------------------------------------
    case "milestone_celebrate": {
      const milestoneId = str("milestoneId", 64);
      if (!/^[0-9a-f-]{36}$/i.test(milestoneId))
        return { ok: false, message: "Unknown milestone." };
      const result = await partnerSvc.celebrateMilestone(preg.id, milestoneId, user.id, actorName);
      if (result.first) {
        await bumpStats(momId, { mood: 6, baby_bond: 3 });
        const other = isPartner ? momId : preg.partner_user_id;
        if (other) {
          await queueCommand(other, isPartner ? "hud" : "partner", "hearts", {});
        }
      }
      return { ok: result.ok, message: result.message };
    }

    // ---- partner-only preferences -------------------------------------------
    case "partner_reaction_settings": {
      if (!isPartner) return { ok: false, message: "That is a Partner HUD setting." };
      const mode = String(params.mode ?? "");
      const style = String(params.style ?? "");
      const patch: Record<string, unknown> = {};
      if (["manual", "auto", "off"].includes(mode)) patch.reactionMode = mode;
      if (REACTION_STYLES.some((r) => r.key === style)) patch.reactionStyle = style;
      const title = String(params.title ?? "");
      if ((PARTNER_TITLES as readonly string[]).includes(title)) patch.partnerTitle = title;
      if (!Object.keys(patch).length) return { ok: false, message: "Nothing to save." };
      await db().query(
        `insert into user_settings (user_id, settings) values ($1, $2)
         on conflict (user_id) do update set settings = user_settings.settings || excluded.settings`,
        [user.id, JSON.stringify(patch)],
      );
      return { ok: true, message: "Saved ✓" };
    }

    // ---- "check on her" -------------------------------------------------------
    case "partner_status": {
      const ctx = isPartner ? await partnerSvc.partnerContext(user) : null;
      if (isPartner && !ctx) return { ok: false, message: "You are not linked to a pregnancy." };
      const summary = await checkOnMom(preg, ctx?.permissions ?? null);
      if (isPartner) {
        await addPartnerActivity(preg.id, actorName, "Checked on mom", 3);
        await queueCommand(momId, "hud", "say", { text: actorName + " is checking in on you." });
      }
      return { ok: true, message: summary.line, summary };
    }

    default:
      return { ok: false, message: `Unknown action: ${action}` };
  }
}

// ---------------------------------------------------------------------------
// Registration (LSL entry point)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Test mode
//
// Labor is normally drawn once, at a random point between weeks 37 and 42, and
// then runs for 45–240 real minutes. That is right for play and impossible for
// a two-person test session, so these actions exist — behind a code, so a real
// player never trips over them.
//
// They work by rewriting the drawn plan rather than by special-casing the
// engine: labor.ts stays the only thing that decides what happens, and putting
// the backed-up plan back returns the pregnancy to exactly where it was.
// ---------------------------------------------------------------------------

function testCode(): string {
  return process.env.HUD_TEST_CODE?.trim() || TEST_MODE_CODE;
}

async function requireTestMode(preg: Record<string, any>, user: HudUser): Promise<string | null> {
  // The flag is not the only gate: a partner on a pregnancy she put into test
  // mode must still not be able to start her labor.
  if (user.role !== "mom") return "Only the wearer can use the test tools.";
  if (!preg.test_mode) return "Test mode is locked. Enter the code in Settings first.";
  return null;
}

/** Snapshot the real plan once, so "leave test mode" can restore it. */
async function backupLaborPlan(pregnancyId: string) {
  await db().query(
    `update pregnancies
        set labor_plan_backup = coalesce(labor_plan_backup, labor_plan),
            labor_onset_backup = coalesce(labor_onset_backup, labor_onset_frac)
      where id = $1`,
    [pregnancyId],
  );
}

export async function registerDevice(opts: {
  avatarKey: string;
  avatarName: string;
  kind: "hud" | "belly" | "partner";
  objectKey: string;
  callbackUrl: string | null;
  region: string | null;
  publicUrl?: string;
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
  const path = opts.kind === "partner" ? "/partner" : "/";
  const origin = opts.publicUrl || appUrl();
  return {
    token,
    week,
    moap_url: `${origin}${path}?token=${token}`,
    welcome: `Welcome back, ${user.avatar_name.split(" ")[0]} - Week ${week} - touch the screen to open your dashboard.`,
  };
}
