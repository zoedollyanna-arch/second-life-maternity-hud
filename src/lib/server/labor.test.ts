// Labor engine maths. No database — these pin down the rules that decide when
// a baby arrives, which is the one part of this system nobody can press a
// button to override.

import { describe, it, expect } from "vitest";
import { makeLaborPlan, snapshotOf, PHASE_ORDER, type LaborPlan } from "./labor";

/** Deterministic rng so a drawn plan can be asserted exactly. */
function seeded(values: number[]) {
  let i = 0;
  return () => values[i++ % values.length];
}

const DAY = 86_400_000;

function pregRow(over: Record<string, unknown> = {}) {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    status: "active",
    conceived_at: new Date(Date.now() - 30 * DAY).toISOString(),
    duration_days: 30,
    setup_complete: true,
    labor_phase: "none",
    labor_stage: "none",
    labor_onset_frac: null,
    labor_plan: {},
    contraction_intensity: 0,
    water_broken_at: null,
    contractions_started_at: null,
    hospital_at: null,
    birth_at: null,
    ...over,
  } as never;
}

describe("makeLaborPlan", () => {
  it("always starts labor inside the realistic term window (37–42 weeks)", () => {
    for (let i = 0; i < 500; i++) {
      const { onsetFrac } = makeLaborPlan(30);
      const weeks = onsetFrac * 40;
      expect(weeks).toBeGreaterThanOrEqual(37);
      expect(weeks).toBeLessThanOrEqual(42);
    }
  });

  it("clusters around 39–40 weeks rather than spreading flat", () => {
    const weeks = Array.from({ length: 2000 }, () => makeLaborPlan(30).onsetFrac * 40);
    const mean = weeks.reduce((a, b) => a + b, 0) / weeks.length;
    expect(mean).toBeGreaterThan(39);
    expect(mean).toBeLessThan(40);
    // A bell, not a uniform: the middle two weeks must hold most of the mass.
    const middle = weeks.filter((w) => w >= 38.5 && w <= 40.5).length / weeks.length;
    expect(middle).toBeGreaterThan(0.5);
  });

  it("keeps labor a playable length whatever the pregnancy duration", () => {
    for (const days of [1, 7, 30, 90, 280]) {
      for (let i = 0; i < 50; i++) {
        const { plan } = makeLaborPlan(days);
        expect(plan.totalMinutes).toBeGreaterThanOrEqual(30);
        expect(plan.totalMinutes).toBeLessThanOrEqual(300);
      }
    }
  });

  it("orders the phases and never schedules a stage past the birth", () => {
    for (let i = 0; i < 300; i++) {
      const { plan } = makeLaborPlan(30);
      expect(plan.active).toBeLessThan(plan.transition);
      expect(plan.transition).toBeLessThan(plan.pushing);
      expect(plan.pushing).toBeLessThan(plan.totalMinutes);
      expect(plan.waterAt).toBeLessThanOrEqual(plan.totalMinutes);
      expect(plan.hospitalAt).toBeLessThanOrEqual(plan.totalMinutes);
    }
  });

  it("breaks the waters first roughly one time in seven", () => {
    let first = 0;
    const runs = 3000;
    for (let i = 0; i < runs; i++) {
      const { plan } = makeLaborPlan(30);
      if (plan.waterAt <= plan.totalMinutes * 0.05) first++;
    }
    const rate = first / runs;
    expect(rate).toBeGreaterThan(0.08);
    expect(rate).toBeLessThan(0.25);
  });

  it("is driven purely by its rng, so a seeded draw is reproducible", () => {
    const seed = [0.5, 0.5, 0.5, 0.5, 0.9, 0.4, 0.4];
    const a = makeLaborPlan(30, seeded(seed));
    const b = makeLaborPlan(30, seeded(seed));
    expect(a).toEqual(b);
    expect(a.onsetFrac * 40).toBeCloseTo(39.5, 5);
  });
});

describe("snapshotOf", () => {
  const plan: LaborPlan = {
    v: 1,
    totalMinutes: 100,
    waterAt: 40,
    hospitalAt: 40,
    active: 30,
    transition: 70,
    pushing: 88,
  };

  it("reports no labor before the pregnancy has a plan", () => {
    const snap = snapshotOf(pregRow());
    expect(snap.inLabor).toBe(false);
    expect(snap.phase).toBe("none");
    expect(snap.minutesToBirth).toBeNull();
  });

  it("counts down to the birth from how far into labor she is", () => {
    // 30-day pregnancy, onset at exactly the due date, 10 real minutes elapsed.
    const conceived = new Date(Date.now() - (30 * DAY + 10 * 60_000));
    const snap = snapshotOf(
      pregRow({
        conceived_at: conceived.toISOString(),
        labor_onset_frac: 1,
        labor_plan: plan,
        labor_phase: "early",
      }),
    );
    expect(snap.minutesIn).toBe(10);
    expect(snap.minutesToBirth).toBe(90);
    expect(snap.inLabor).toBe(true);
  });

  it("only advises the hospital once labor has reached that point", () => {
    const at = (minutes: number) =>
      snapshotOf(
        pregRow({
          conceived_at: new Date(Date.now() - (30 * DAY + minutes * 60_000)).toISOString(),
          labor_onset_frac: 1,
          labor_plan: plan,
          labor_phase: "active",
        }),
      ).hospitalAdvised;

    expect(at(10)).toBe(false);
    expect(at(39)).toBe(false);
    expect(at(45)).toBe(true);
  });

  it("never advises the hospital while she is not yet in labor", () => {
    const snap = snapshotOf(
      pregRow({
        conceived_at: new Date(Date.now() - 30 * DAY).toISOString(),
        labor_onset_frac: 1.02,
        labor_plan: plan,
        labor_phase: "prelabor",
      }),
    );
    expect(snap.hospitalAdvised).toBe(false);
    expect(snap.inLabor).toBe(false);
  });

  it("treats a delivered pregnancy as finished, not in labor", () => {
    const snap = snapshotOf(
      pregRow({
        labor_onset_frac: 1,
        labor_plan: plan,
        labor_phase: "delivered",
        birth_at: new Date().toISOString(),
      }),
    );
    expect(snap.inLabor).toBe(false);
    expect(snap.minutesToBirth).toBe(0);
  });

  it("keeps rescaling safe: onset is a fraction, so it survives a duration change", () => {
    // Same fraction, two different durations — labor stays at the same point in
    // the pregnancy rather than jumping to a different week.
    const frac = 0.99;
    for (const days of [30, 60]) {
      const snap = snapshotOf(
        pregRow({
          duration_days: days,
          conceived_at: new Date(Date.now() - frac * days * DAY).toISOString(),
          labor_onset_frac: frac,
          labor_plan: plan,
          labor_phase: "none",
        }),
      );
      expect(Math.abs(snap.minutesIn)).toBeLessThan(2);
      expect(snap.onsetWeek).toBeCloseTo(39.6, 1);
    }
  });
});

describe("phase ordering", () => {
  it("is a one-way sequence the engine can only step forward through", () => {
    expect(PHASE_ORDER).toEqual([
      "none",
      "prelabor",
      "early",
      "active",
      "transition",
      "pushing",
      "delivered",
    ]);
  });
});
