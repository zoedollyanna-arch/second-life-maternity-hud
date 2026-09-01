// Labor engine.
//
// Labor is decided here and nowhere else. There is no button, on either HUD,
// that starts contractions, breaks the waters or delivers the baby — the
// pregnancy reaches term and the server does it, at a randomised point, the
// way it happens in life. Both HUDs are readers of this state.
//
// The engine is *lazy*: it has no cron. It is evaluated on every dashboard
// read and every action, by either partner, and it is safe to run concurrently
// — each transition is a guarded UPDATE and each announcement carries a dedupe
// key, so two simultaneous polls cannot double-fire an event.

import { db } from "./db";
import { publishEvent } from "./bus";

export type LaborPhase =
  "none" | "prelabor" | "early" | "active" | "transition" | "pushing" | "delivered";

const PHASE_ORDER: LaborPhase[] = [
  "none",
  "prelabor",
  "early",
  "active",
  "transition",
  "pushing",
  "delivered",
];

export interface LaborPlan {
  v: 1;
  /** Total real minutes from first contraction to birth. */
  totalMinutes: number;
  /** Minutes after onset at which the waters break (can be ~0 = waters first). */
  waterAt: number;
  /** Minutes after onset at which heading to hospital is advised. */
  hospitalAt: number;
  active: number;
  transition: number;
  pushing: number;
}

/** How long before onset the "something is starting" phase shows. */
const PRELABOR_MINUTES = 90;

/**
 * Draw a labor plan. Onset is a gestational *fraction*, not a timestamp, so
 * that rescaling duration_days (settings_update moves conceived_at) keeps
 * labor at the same point in the pregnancy instead of teleporting it.
 */
export function makeLaborPlan(durationDays: number, rng: () => number = Math.random) {
  // Weeks 37–42, bell-shaped around ~39.5 — the realistic spread of term birth.
  const weeks = 37 + ((rng() + rng() + rng()) / 3) * 5;
  const onsetFrac = weeks / 40;

  // Labor length scales with how compressed the pregnancy is, but stays inside
  // a window that is actually playable in a roleplay scene.
  // Clamp AFTER the jitter, not before: clamping the base first let the ±30%
  // spread push a long pregnancy back out past five hours of labor.
  const base = 40 + durationDays * 1.2;
  const totalMinutes = Math.round(Math.min(240, Math.max(45, base * (0.7 + rng() * 0.6))));

  // ~15% of the time the waters go first; otherwise somewhere mid-labor.
  const watersFirst = rng() < 0.15;
  const waterAt = watersFirst
    ? Math.round(rng() * 0.04 * totalMinutes)
    : Math.round((0.15 + rng() * 0.6) * totalMinutes);

  const plan: LaborPlan = {
    v: 1,
    totalMinutes,
    waterAt,
    hospitalAt: Math.round(Math.max(waterAt, totalMinutes * 0.35)),
    active: Math.round(totalMinutes * 0.3),
    transition: Math.round(totalMinutes * 0.7),
    pushing: Math.round(totalMinutes * 0.88),
  };
  return { onsetFrac, plan };
}

export interface LaborSnapshot {
  phase: LaborPhase;
  /** Existing labor_stage vocabulary, kept for the LSL scripts and old UI. */
  stage: string;
  inLabor: boolean;
  intensity: number;
  waterBroken: boolean;
  hospitalAdvised: boolean;
  atHospital: boolean;
  minutesIn: number;
  minutesToBirth: number | null;
  onsetWeek: number;
}

interface PregRow {
  id: string;
  status: string;
  conceived_at: string;
  duration_days: number;
  setup_complete: boolean;
  labor_phase: LaborPhase;
  labor_stage: string;
  labor_onset_frac: string | number | null;
  labor_plan: LaborPlan | Record<string, never>;
  contraction_intensity: number;
  water_broken_at: string | null;
  contractions_started_at: string | null;
  hospital_at: string | null;
  birth_at: string | null;
  [key: string]: unknown;
}

export type LaborTransition =
  { kind: "phase"; phase: LaborPhase } | { kind: "water" } | { kind: "hospital_advised" };

function phaseFor(minutesIn: number, plan: LaborPlan): LaborPhase {
  if (minutesIn >= plan.totalMinutes) return "delivered";
  if (minutesIn >= plan.pushing) return "pushing";
  if (minutesIn >= plan.transition) return "transition";
  if (minutesIn >= plan.active) return "active";
  if (minutesIn >= 0) return "early";
  if (minutesIn >= -PRELABOR_MINUTES) return "prelabor";
  return "none";
}

function intensityFor(minutesIn: number, phase: LaborPhase, plan: LaborPlan): number {
  const span = (from: number, to: number, lo: number, hi: number) => {
    const width = Math.max(1, to - from);
    const p = Math.min(1, Math.max(0, (minutesIn - from) / width));
    return Math.round(lo + p * (hi - lo));
  };
  switch (phase) {
    case "early":
      return span(0, plan.active, 25, 45);
    case "active":
      return span(plan.active, plan.transition, 45, 75);
    case "transition":
      return span(plan.transition, plan.pushing, 75, 95);
    case "pushing":
      return span(plan.pushing, plan.totalMinutes, 95, 100);
    case "delivered":
      return 0;
    default:
      return 0;
  }
}

function laborStageFor(row: {
  phase: LaborPhase;
  waterBroken: boolean;
  atHospital: boolean;
}): string {
  if (row.phase === "delivered") return "delivered";
  if (row.phase === "pushing") return "birth";
  if (row.phase === "none" || row.phase === "prelabor") return "none";
  if (row.atHospital) return "hospital";
  if (row.waterBroken) return "water_broken";
  return "contractions";
}

/** Uncapped progress fraction — computeProgress clamps at 1, term does not. */
function rawFraction(conceivedAt: string, durationDays: number, now: number): number {
  const total = Math.max(1, durationDays) * 86_400_000;
  return (now - new Date(conceivedAt).getTime()) / total;
}

/**
 * Give a pregnancy its labor plan the first time it is evaluated. Existing
 * pregnancies that are already past their drawn onset get pushed out by a
 * grace window, so deploying this never makes somebody give birth on load.
 */
async function ensurePlan(preg: PregRow, now: number): Promise<PregRow> {
  if (preg.labor_onset_frac != null && (preg.labor_plan as LaborPlan)?.v === 1) return preg;

  const durationDays = Number(preg.duration_days);
  const { onsetFrac, plan } = makeLaborPlan(durationDays);
  const current = rawFraction(preg.conceived_at, durationDays, now);
  const graceFrac = 20 / (durationDays * 1440); // at least 20 real minutes away
  const safeOnset = Math.max(onsetFrac, current + graceFrac);

  const { rows } = await db().query(
    `update pregnancies
        set labor_onset_frac = $2, labor_plan = $3, updated_at = now()
      where id = $1 and (labor_onset_frac is null or labor_plan->>'v' is null)
      returning *`,
    [preg.id, safeOnset, JSON.stringify(plan)],
  );
  if (rows[0]) return rows[0] as PregRow;

  // Another concurrent request planned it first — take theirs.
  const fresh = await db().query(`select * from pregnancies where id = $1`, [preg.id]);
  return (fresh.rows[0] as PregRow) ?? preg;
}

export function snapshotOf(preg: PregRow, now = Date.now()): LaborSnapshot {
  const plan = preg.labor_plan as LaborPlan;
  const onset = preg.labor_onset_frac == null ? null : Number(preg.labor_onset_frac);
  const durationDays = Number(preg.duration_days);
  const phase = (preg.labor_phase ?? "none") as LaborPhase;
  const waterBroken = Boolean(preg.water_broken_at);
  const atHospital = Boolean(preg.hospital_at);

  let minutesIn = 0;
  let minutesToBirth: number | null = null;
  if (onset != null && plan?.v === 1) {
    minutesIn = (rawFraction(preg.conceived_at, durationDays, now) - onset) * durationDays * 1440;
    minutesToBirth =
      phase === "delivered" ? 0 : Math.max(0, Math.round(plan.totalMinutes - minutesIn));
  }

  return {
    phase,
    stage: preg.labor_stage ?? "none",
    inLabor: PHASE_ORDER.indexOf(phase) >= PHASE_ORDER.indexOf("early") && phase !== "delivered",
    intensity: Number(preg.contraction_intensity ?? 0),
    waterBroken,
    hospitalAdvised:
      plan?.v === 1 && phase !== "none" && phase !== "prelabor" && minutesIn >= plan.hospitalAt,
    atHospital,
    minutesIn: Math.round(minutesIn),
    minutesToBirth,
    onsetWeek: onset == null ? 0 : Math.round(onset * 40 * 10) / 10,
  };
}

/**
 * Advance the pregnancy's labor state to wherever real time says it should be.
 * Returns the refreshed row plus the transitions that happened on this tick —
 * game.ts turns those into stat changes, journal entries and in-world effects.
 */
export async function runLaborEngine(
  preg: PregRow,
  now = Date.now(),
): Promise<{ preg: PregRow; transitions: LaborTransition[] }> {
  const transitions: LaborTransition[] = [];

  // Only a live, set-up pregnancy has a labor to run.
  if (preg.status !== "active" || !preg.setup_complete) return { preg, transitions };
  if (preg.labor_phase === "delivered" || preg.labor_stage === "delivered") {
    return { preg, transitions };
  }

  let row = await ensurePlan(preg, now);
  const plan = row.labor_plan as LaborPlan;
  const onset = Number(row.labor_onset_frac);
  if (plan?.v !== 1 || !Number.isFinite(onset)) return { preg: row, transitions };

  const durationDays = Number(row.duration_days);
  const minutesIn =
    (rawFraction(row.conceived_at, durationDays, now) - onset) * durationDays * 1440;
  const target = phaseFor(minutesIn, plan);

  // The waters break on their own schedule, independent of the phase steps.
  if (minutesIn >= plan.waterAt && minutesIn >= 0 && !row.water_broken_at) {
    const { rows } = await db().query(
      `update pregnancies set water_broken_at = now(), updated_at = now()
        where id = $1 and water_broken_at is null returning *`,
      [row.id],
    );
    if (rows[0]) {
      row = rows[0] as PregRow;
      transitions.push({ kind: "water" });
    }
  }

  // Step one phase at a time so a HUD that was closed for an hour still gets a
  // truthful history rather than one jump straight to "delivered".
  let guard = 0;
  while (PHASE_ORDER.indexOf(target) > PHASE_ORDER.indexOf(row.labor_phase) && guard++ < 8) {
    const next = PHASE_ORDER[PHASE_ORDER.indexOf(row.labor_phase) + 1];
    const waterBroken = Boolean(row.water_broken_at);
    const stage = laborStageFor({
      phase: next,
      waterBroken,
      atHospital: Boolean(row.hospital_at),
    });
    const intensity = intensityFor(minutesIn, next, plan);

    const sets = [
      `labor_phase = $2`,
      `labor_stage = $3`,
      `contraction_intensity = $4`,
      `labor_engine_at = now()`,
      `updated_at = now()`,
    ];
    if (next === "early")
      sets.push(`contractions_started_at = coalesce(contractions_started_at, now())`);
    if (next === "delivered") {
      sets.push(`birth_at = coalesce(birth_at, now())`);
      sets.push(`status = 'delivered'`);
    }

    const { rows } = await db().query(
      `update pregnancies set ${sets.join(", ")}
        where id = $1 and labor_phase = $5 returning *`,
      [row.id, next, stage, intensity, row.labor_phase],
    );
    // Lost the race to a concurrent request; re-read and re-evaluate.
    if (!rows[0]) {
      const fresh = await db().query(`select * from pregnancies where id = $1`, [row.id]);
      row = fresh.rows[0] as PregRow;
      continue;
    }
    row = rows[0] as PregRow;
    transitions.push({ kind: "phase", phase: next });
  }

  // Keep the intensity meter live inside a phase without churning events.
  if (
    row.labor_phase !== "none" &&
    row.labor_phase !== "prelabor" &&
    row.labor_phase !== "delivered"
  ) {
    const intensity = intensityFor(minutesIn, row.labor_phase, plan);
    if (Math.abs(intensity - Number(row.contraction_intensity ?? 0)) >= 2) {
      const { rows } = await db().query(
        `update pregnancies set contraction_intensity = $2, labor_engine_at = now()
          where id = $1 returning *`,
        [row.id, intensity],
      );
      if (rows[0]) row = rows[0] as PregRow;
    }
  }

  // "Time to go" is announced once, by the engine, to both of them.
  if (
    minutesIn >= plan.hospitalAt &&
    row.labor_phase !== "none" &&
    row.labor_phase !== "prelabor" &&
    row.labor_phase !== "delivered" &&
    !row.hospital_at
  ) {
    const announced = await publishEvent(row.id, "GO_TO_HOSPITAL", "Time to go to the hospital", {
      severity: "urgent",
      body: "Labor is established. Head in when you're ready.",
      dedupeKey: "go_to_hospital_advised",
    });
    if (announced) transitions.push({ kind: "hospital_advised" });
  }

  return { preg: row, transitions };
}

/** Recomputed stage string for callers that changed hospital_at themselves. */
export { laborStageFor, PHASE_ORDER };
