import { db } from "./db";
import { addNotification, queueCommand } from "./bus";
import { careProp, propDeltas } from "../props";
import {
  PRENATAL_MISS_DELTAS,
  WATER_COOLDOWN_MS,
  cooldownMessage,
  doseReady,
  prenatalIntervalMs,
  prenatalMissDue,
} from "../care";

export interface CareDoseStatus {
  ready: boolean;
  nextAt: string | null;
}

export interface CareStatus {
  prenatals: CareDoseStatus;
  water: CareDoseStatus;
}

function choiceList(choices: unknown): { key?: string }[] {
  if (Array.isArray(choices)) return choices as { key?: string }[];
  if (typeof choices === "string") {
    try {
      const parsed = JSON.parse(choices) as unknown;
      return Array.isArray(parsed) ? (parsed as { key?: string }[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function includesChoice(choices: unknown, key: string): boolean {
  return choiceList(choices).some((choice) => {
    if (typeof choice === "string") {
      const text = choice as string;
      return text === key || text.startsWith(`${key}|`);
    }
    return choice?.key === key;
  });
}

async function readSchedule(userId: string) {
  const { rows } = await db().query(
    `select prenatal_completed_at, prenatal_miss_marked_at, water_completed_at
       from care_schedule where user_id = $1`,
    [userId],
  );
  return rows[0] as
    | {
        prenatal_completed_at: string | null;
        prenatal_miss_marked_at: string | null;
        water_completed_at: string | null;
      }
    | undefined;
}

function stamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

export async function careStatus(
  userId: string,
  durationDays: number,
  now = Date.now(),
): Promise<CareStatus> {
  const row = await readSchedule(userId);
  return {
    prenatals: doseReady(stamp(row?.prenatal_completed_at), prenatalIntervalMs(durationDays), now),
    water: doseReady(stamp(row?.water_completed_at), WATER_COOLDOWN_MS, now),
  };
}

export async function settleMissedPrenatal(
  userId: string,
  pregnancyId: string,
  durationDays: number,
  conceivedAt: Date,
): Promise<Partial<typeof PRENATAL_MISS_DELTAS> | null> {
  const client = await db().connect();
  try {
    await client.query("begin");
    await client.query(
      `insert into care_schedule (user_id) values ($1) on conflict (user_id) do nothing`,
      [userId],
    );
    const { rows } = await client.query(
      `select prenatal_completed_at, prenatal_miss_marked_at
         from care_schedule where user_id = $1 for update`,
      [userId],
    );
    const row = rows[0];
    const due = prenatalMissDue({
      now: Date.now(),
      conceivedAt: conceivedAt.getTime(),
      completedAt: stamp(row?.prenatal_completed_at),
      missMarkedAt: stamp(row?.prenatal_miss_marked_at),
      durationDays,
    });
    if (!due) {
      await client.query("commit");
      return null;
    }
    const entries = Object.entries(PRENATAL_MISS_DELTAS);
    await client.query(
      `update user_stats set ${entries
        .map(([stat], i) => `${stat}=greatest(0, least(100, ${stat}+$${i + 2}))`)
        .join(", ")}, updated_at=now() where user_id=$1`,
      [userId, ...entries.map(([, delta]) => delta)],
    );
    await client.query(
      `insert into wellness_logs (user_id, pregnancy_id, action, deltas, note)
       values ($1,$2,$3,$4,$5)`,
      [
        userId,
        pregnancyId,
        "prenatal_missed",
        JSON.stringify(PRENATAL_MISS_DELTAS),
        "A prenatal dose window passed",
      ],
    );
    await client.query(
      `update care_schedule set prenatal_miss_marked_at = now() where user_id = $1`,
      [userId],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
  try {
    await addNotification(
      userId,
      "A prenatal slipped by",
      "The dose window passed. Baby is okay — the next bottle will help ♥",
      { pregnancyId, eventType: "prenatal_missed" },
    );
  } catch (error) {
    console.error("prenatal miss notice", error);
  }
  return PRENATAL_MISS_DELTAS;
}

export async function requestProp(
  userId: string,
  key: unknown,
  inLabor: boolean,
  durationDays = 28,
) {
  const prop = careProp(key);
  if (!prop) return { ok: false, message: "That prop is not in this testing pack." };
  if (prop.key === "water" && inLabor) {
    return { ok: false, message: "Use the Ice chips care action during this HUD's labor scene." };
  }
  if (prop.key === "water" || prop.key === "prenatals") {
    const status = await careStatus(userId, durationDays);
    const dose = prop.key === "prenatals" ? status.prenatals : status.water;
    if (!dose.ready) return { ok: false, message: cooldownMessage(prop.key, dose.nextAt) };
  }
  await queueCommand(userId, "hud", "give_prop", { item: prop.object });
  const hint =
    prop.key === "prenatals"
      ? "Accept the bottle, then Add it. The goodness counts when you finish taking it ♥"
      : prop.key === "water"
        ? "Accept the lemon water, then Add it. Hydration counts when you finish the sip ♥"
        : `Nestoria Food Delivery sent ${prop.name}. Accept it, then Add it. Mom's care updates when you finish ♥`;
  return { ok: true, message: hint, delivery: true };
}

/** The receipt, stat changes and wellness log commit together, or all roll back. */
export async function completeProp(
  userId: string,
  pregnancyId: string,
  key: unknown,
  useId: unknown,
  inLabor: boolean,
  durationDays = 28,
) {
  const prop = careProp(key);
  if (
    !prop ||
    typeof useId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(useId)
  ) {
    return { ok: false, message: "Invalid prop completion. Update the prop script and try again." };
  }
  const client = await db().connect();
  let satisfied = false;
  try {
    await client.query("begin");
    await client.query(
      `insert into care_schedule (user_id) values ($1) on conflict (user_id) do nothing`,
      [userId],
    );
    const schedule = await client.query(
      `select prenatal_completed_at, water_completed_at
         from care_schedule where user_id = $1 for update`,
      [userId],
    );
    const receipt = await client.query(
      `insert into prop_uses (user_id, use_id, prop_key, pregnancy_id)
       values ($1, $2, $3, $4) on conflict do nothing returning use_id`,
      [userId, useId, prop.key, pregnancyId],
    );
    if (!receipt.rowCount) {
      const previous = await client.query(
        `select prop_key from prop_uses where user_id=$1 and use_id=$2`,
        [userId, useId],
      );
      await client.query("rollback");
      return previous.rows[0]?.prop_key === prop.key
        ? { ok: true, message: `${prop.name} already enjoyed. Care is saved ♥` }
        : { ok: false, message: "This use belongs to a different prop." };
    }
    if (prop.key === "water" && inLabor) {
      await client.query("rollback");
      return { ok: false, message: "Labor has started. Use the HUD's Ice chips action instead." };
    }
    if (prop.key === "water" || prop.key === "prenatals") {
      const row = schedule.rows[0];
      const completedAt =
        prop.key === "prenatals" ? stamp(row?.prenatal_completed_at) : stamp(row?.water_completed_at);
      const interval = prop.key === "prenatals" ? prenatalIntervalMs(durationDays) : WATER_COOLDOWN_MS;
      const dose = doseReady(completedAt, interval, Date.now());
      if (!dose.ready) {
        await client.query("rollback");
        return { ok: false, message: cooldownMessage(prop.key, dose.nextAt) };
      }
    }
    const deltas = propDeltas(prop);
    const entries = Object.entries(deltas);
    const updated = await client.query(
      `update user_stats set ${entries.map(([stat], i) => `${stat}=greatest(0, least(100, ${stat}+$${i + 2}))`).join(", ")}, updated_at=now() where user_id=$1`,
      [userId, ...entries.map(([, delta]) => delta)],
    );
    if (updated.rowCount !== 1) throw new Error("Missing wearer stats");
    await client.query(
      `insert into wellness_logs (user_id, pregnancy_id, action, deltas, note) values ($1,$2,$3,$4,$5)`,
      [userId, pregnancyId, "prop_complete", JSON.stringify(deltas), `Enjoyed ${prop.name}`],
    );
    if (prop.key === "prenatals" || prop.key === "water") {
      const column = prop.key === "prenatals" ? "prenatal_completed_at" : "water_completed_at";
      await client.query(`update care_schedule set ${column} = now() where user_id = $1`, [userId]);
      const choiceKey = prop.key === "prenatals" ? "vitamins" : "water";
      const open = await client.query(
        `select id, choices from event_history
          where pregnancy_id = $1 and answered_at is null
          order by created_at desc limit 1`,
        [pregnancyId],
      );
      if (open.rows[0] && includesChoice(open.rows[0].choices, choiceKey)) {
        const closed = await client.query(
          `update event_history set answered_at = now(), choice = $2
            where id = $1 and answered_at is null`,
          [open.rows[0].id, choiceKey],
        );
        satisfied = closed.rowCount === 1;
      }
    }
    await client.query("commit");
    const name = prop.key === "water" ? "Lemon water" : prop.name;
    return {
      ok: true,
      message: satisfied
        ? `${name} enjoyed. That little moment is taken care of ♥`
        : `${name} enjoyed. Care updated ♥`,
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
