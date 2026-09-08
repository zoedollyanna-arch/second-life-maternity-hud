// Conception rules.
//
// These three decide things a player notices immediately — whether the button
// worked, how long she waits, and whether a test lies to her — so they are
// pinned down directly rather than only through the database-backed suite,
// which is skipped unless TEST_DATABASE_URL is set.

import { describe, it, expect } from "vitest";
import {
  ATTEMPT_COOLDOWN_MINUTES,
  FERTILITY_CHANCE,
  FERTILITY_COPY,
  FERTILITY_LEVELS,
  TEST_WAIT_MINUTES,
  attemptCooldown,
  chanceFor,
  normalizeFertility,
  readTest,
  rollAttempt,
  testReadyFrom,
} from "./conception";

const MINUTE = 60_000;
const T0 = Date.UTC(2026, 0, 1, 12, 0, 0);

/** Deterministic rng so a roll can be asserted exactly. */
const fixed = (v: number) => () => v;

describe("fertility", () => {
  it("has a chance for every level, all strictly between 0 and 1", () => {
    for (const level of FERTILITY_LEVELS) {
      const c = FERTILITY_CHANCE[level];
      expect(c, level).toBeGreaterThan(0);
      expect(c, level).toBeLessThan(1);
    }
  });

  it("orders the levels the way the labels promise", () => {
    expect(FERTILITY_CHANCE.low).toBeLessThan(FERTILITY_CHANCE.normal);
    expect(FERTILITY_CHANCE.normal).toBeLessThan(FERTILITY_CHANCE.high);
  });

  it("labels and explains every level, so no button renders blank", () => {
    for (const level of FERTILITY_LEVELS) {
      expect(FERTILITY_COPY[level].label, level).toBeTruthy();
      expect(FERTILITY_COPY[level].hint, level).toBeTruthy();
    }
  });

  it("falls back to normal for anything unrecognised rather than scoring zero", () => {
    for (const bad of [null, undefined, "", "HIGH", "medium", 3, {}, []]) {
      expect(normalizeFertility(bad), String(bad)).toBe("normal");
      expect(chanceFor(bad), String(bad)).toBe(FERTILITY_CHANCE.normal);
    }
  });

  it("accepts the exact stored values", () => {
    for (const level of FERTILITY_LEVELS) {
      expect(normalizeFertility(level)).toBe(level);
    }
  });
});

describe("attempt cooldown", () => {
  it("never blocks a first attempt", () => {
    for (const empty of [null, undefined, ""]) {
      expect(attemptCooldown(empty, T0).blocked, String(empty)).toBe(false);
    }
  });

  it("does not lock the button when the timestamp is unreadable", () => {
    // A null here must fail open. Failing closed would strand her forever.
    expect(attemptCooldown("not a date", T0).blocked).toBe(false);
  });

  it("blocks immediately after an attempt", () => {
    const c = attemptCooldown(new Date(T0).toISOString(), T0);
    expect(c.blocked).toBe(true);
    expect(c.minutesLeft).toBe(ATTEMPT_COOLDOWN_MINUTES);
  });

  it("clears exactly on the boundary, not a tick later", () => {
    const last = new Date(T0).toISOString();
    const boundary = T0 + ATTEMPT_COOLDOWN_MINUTES * MINUTE;
    expect(attemptCooldown(last, boundary - 1).blocked).toBe(true);
    expect(attemptCooldown(last, boundary).blocked).toBe(false);
  });

  it("always shows at least one minute while it is still blocking", () => {
    const last = new Date(T0).toISOString();
    // One second left should read "1 min", never "0 min".
    const c = attemptCooldown(last, T0 + ATTEMPT_COOLDOWN_MINUTES * MINUTE - 1000);
    expect(c.blocked).toBe(true);
    expect(c.minutesLeft).toBe(1);
  });

  it("accepts a Date as well as a string", () => {
    expect(attemptCooldown(new Date(T0), T0).blocked).toBe(true);
  });
});

describe("rolling an attempt", () => {
  it("lands when the roll is under the chance and misses when it is over", () => {
    const under = rollAttempt({ fertility: "normal", conceivedOn: null, rng: fixed(0.1) });
    const over = rollAttempt({ fertility: "normal", conceivedOn: null, rng: fixed(0.9) });
    expect(under.conceived).toBe(true);
    expect(over.conceived).toBe(false);
  });

  it("treats the chance as exclusive at the boundary", () => {
    // rng() < chance, so exactly the chance must miss - otherwise "low" would
    // be very slightly more generous than its number says.
    const at = rollAttempt({
      fertility: "low",
      conceivedOn: null,
      rng: fixed(FERTILITY_CHANCE.low),
    });
    expect(at.conceived).toBe(false);
  });

  it("reports the chance it used, for the attempt log", () => {
    expect(rollAttempt({ fertility: "high", conceivedOn: null, rng: fixed(0.5) }).chance).toBe(
      FERTILITY_CHANCE.high,
    );
  });

  it("only writes conception when this attempt is the one that landed", () => {
    expect(
      rollAttempt({ fertility: "high", conceivedOn: null, rng: fixed(0.01) }).writesConception,
    ).toBe(true);
    expect(
      rollAttempt({ fertility: "low", conceivedOn: null, rng: fixed(0.99) }).writesConception,
    ).toBe(false);
  });

  it("never re-rolls once she has already conceived", () => {
    // A second attempt must not be able to un-conceive her, and must not move
    // the test window further away.
    const again = rollAttempt({
      fertility: "low",
      conceivedOn: new Date(T0).toISOString(),
      rng: fixed(0.999),
    });
    expect(again.conceived).toBe(true);
    expect(again.alreadyConceived).toBe(true);
    expect(again.writesConception).toBe(false);
  });

  it("produces roughly the advertised rate over many attempts", () => {
    for (const level of FERTILITY_LEVELS) {
      let hits = 0;
      const runs = 4000;
      for (let i = 0; i < runs; i++) {
        if (rollAttempt({ fertility: level, conceivedOn: null }).conceived) hits++;
      }
      const rate = hits / runs;
      expect(Math.abs(rate - FERTILITY_CHANCE[level]), `${level} rate ${rate}`).toBeLessThan(0.05);
    }
  });
});

describe("reading a test", () => {
  const ready = new Date(testReadyFrom(T0)).toISOString();
  const conceived = new Date(T0).toISOString();

  it("is negative, and not 'too early', when she has not conceived", () => {
    // Saying "it may be too early" on a genuine negative would keep her
    // testing forever chasing a positive that is not coming.
    const r = readTest({ conceivedOn: null, testReadyAt: null, now: T0 });
    expect(r.positive).toBe(false);
    expect(r.tooEarly).toBe(false);
  });

  it("says too early while the window has not passed", () => {
    const r = readTest({ conceivedOn: conceived, testReadyAt: ready, now: T0 + MINUTE });
    expect(r.positive).toBe(false);
    expect(r.tooEarly).toBe(true);
  });

  it("turns positive exactly on the boundary", () => {
    const at = testReadyFrom(T0);
    expect(readTest({ conceivedOn: conceived, testReadyAt: ready, now: at - 1 }).positive).toBe(
      false,
    );
    expect(readTest({ conceivedOn: conceived, testReadyAt: ready, now: at }).positive).toBe(true);
  });

  it("stays positive long afterwards", () => {
    const r = readTest({
      conceivedOn: conceived,
      testReadyAt: ready,
      now: T0 + 30 * 24 * 60 * MINUTE,
    });
    expect(r.positive).toBe(true);
    expect(r.tooEarly).toBe(false);
  });

  it("reads positive when conception is recorded but the window is missing", () => {
    // Should not happen, but defaulting to "not ready" would strand her on a
    // test that never turns positive - far worse than revealing a bit early.
    for (const missing of [null, undefined, "nonsense"]) {
      const r = readTest({ conceivedOn: conceived, testReadyAt: missing, now: T0 });
      expect(r.positive, String(missing)).toBe(true);
    }
  });

  it("accepts Dates as well as strings", () => {
    const r = readTest({
      conceivedOn: new Date(T0),
      testReadyAt: new Date(testReadyFrom(T0)),
      now: testReadyFrom(T0),
    });
    expect(r.positive).toBe(true);
  });

  it("puts the window exactly TEST_WAIT_MINUTES after conception", () => {
    expect(testReadyFrom(T0) - T0).toBe(TEST_WAIT_MINUTES * MINUTE);
  });
});

describe("the whole journey", () => {
  it("goes trying -> conceived -> too early -> positive", () => {
    // Miss first.
    const miss = rollAttempt({ fertility: "normal", conceivedOn: null, rng: fixed(0.99) });
    expect(miss.conceived).toBe(false);
    expect(readTest({ conceivedOn: null, testReadyAt: null, now: T0 }).positive).toBe(false);

    // Then land it.
    const hit = rollAttempt({ fertility: "normal", conceivedOn: null, rng: fixed(0.01) });
    expect(hit.writesConception).toBe(true);

    const conceivedOn = new Date(T0).toISOString();
    const testReadyAt = new Date(testReadyFrom(T0)).toISOString();

    // She tests straight away and is told, truthfully, that it may be early.
    const early = readTest({ conceivedOn, testReadyAt, now: T0 + 30_000 });
    expect(early.positive).toBe(false);
    expect(early.tooEarly).toBe(true);

    // She waits it out.
    const later = readTest({ conceivedOn, testReadyAt, now: testReadyFrom(T0) + MINUTE });
    expect(later.positive).toBe(true);
  });

  it("lets her keep trying while waiting to test, without changing the outcome", () => {
    const conceivedOn = new Date(T0).toISOString();
    for (let i = 0; i < 50; i++) {
      const again = rollAttempt({ fertility: "low", conceivedOn });
      expect(again.conceived).toBe(true);
      expect(again.writesConception).toBe(false);
    }
  });
});
