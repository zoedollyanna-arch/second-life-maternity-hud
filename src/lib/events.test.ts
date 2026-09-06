// RP event roller. No database — these pin down the properties the popup system
// is *for*: that it does not repeat itself, that it reads her actual state, and
// that every moment offers buttons that fit it.
//
// The old engine failed all three (a fixed if/else chain, a 52% mood branch, and
// one hardcoded set of five buttons for every event), which is what "the same
// events keep popping up" meant in practice.

import { describe, it, expect } from "vitest";
import {
  rollEvent,
  choicesForEventKey,
  choiceByKey,
  CHOICE_CATALOG,
  EVENT_DEFINITIONS,
  EVENT_CATEGORIES,
  moodEventDefinitions,
  type EventContext,
} from "./events";
import type { StatName } from "./foods";

const MID_STATS = {
  energy: 55,
  hydration: 50,
  hunger: 48,
  bladder: 45,
  mood: 55,
  immunity: 60,
  sickness: 35,
  rest: 50,
  vitamins: 40,
  comfort: 50,
  nutrition: 50,
  stress: 40,
  baby_wellness: 70,
  baby_bond: 60,
  baby_movement: 55,
} as Record<StatName, number>;

function ctx(over: Partial<EventContext> = {}): EventContext {
  return {
    trimester: 2,
    week: 24,
    stats: { ...MID_STATS },
    mood: "calm",
    partnerLinked: true,
    partnerSupport: 45,
    inLabor: false,
    recentKeys: [],
    disabled: new Set(),
    ...over,
  };
}

/** Play a session the way the server does: each roll remembers the last ones. */
function session(base: Partial<EventContext>, rolls: number): string[] {
  const recent: string[] = [];
  let mood: EventContext["mood"] = base.mood ?? "calm";
  for (let i = 0; i < rolls; i++) {
    const event = rollEvent(ctx({ ...base, mood, recentKeys: recent.slice(0, 10) }));
    if (!event) break;
    recent.unshift(event.key);
    if (event.moodAfter) mood = event.moodAfter;
  }
  return recent.reverse();
}

describe("catalogue", () => {
  it("offers a real spread of moments, not a handful of branches", () => {
    expect(EVENT_DEFINITIONS.length + moodEventDefinitions().length).toBeGreaterThanOrEqual(35);
  });

  it("gives every event at least three usable choices and some body text", () => {
    for (const def of EVENT_DEFINITIONS) {
      expect(def.choices.length, def.key).toBeGreaterThanOrEqual(3);
      expect(def.bodies.length, def.key).toBeGreaterThan(0);
      for (const key of def.choices) {
        expect(CHOICE_CATALOG[key], `${def.key} -> ${key}`).toBeDefined();
      }
    }
  });

  it("keeps in-world button labels inside the llDialog 24-byte limit", () => {
    for (const choice of Object.values(CHOICE_CATALOG)) {
      expect(choice.short.length, choice.key).toBeLessThanOrEqual(24);
    }
  });

  it("resolves choices for every event key, including mood swings", () => {
    for (const def of [...EVENT_DEFINITIONS, ...moodEventDefinitions()]) {
      const choices = choicesForEventKey(def.key);
      expect(choices.length, def.key).toBeGreaterThanOrEqual(3);
      expect(choices.length, def.key).toBeLessThanOrEqual(5);
    }
  });

  it("still resolves choice keys written by the previous engine", () => {
    for (const legacy of [
      "rub_belly",
      "count_kick",
      "water",
      "rest",
      "journal",
      "eat",
      "healthy",
    ]) {
      expect(choiceByKey(legacy), legacy).toBeDefined();
    }
  });
});

describe("repetition", () => {
  it("never fires the same event twice in a row", () => {
    for (const trimester of [1, 2, 3] as const) {
      const seen = session(
        { trimester, week: trimester === 1 ? 9 : trimester === 2 ? 22 : 35 },
        120,
      );
      for (let i = 1; i < seen.length; i++) {
        expect(seen[i], `${seen[i]} repeated back to back`).not.toBe(seen[i - 1]);
      }
    }
  });

  it("moves through the catalogue rather than orbiting a few events", () => {
    const seen = session({ trimester: 2, week: 24 }, 60);
    expect(new Set(seen).size).toBeGreaterThanOrEqual(18);
  });

  it("keeps mood swings to a minority of rolls", () => {
    const seen = session({ trimester: 2, week: 24 }, 200);
    const moodShare = seen.filter((k) => k.startsWith("mood_")).length / seen.length;
    expect(moodShare).toBeLessThan(0.45);
  });
});

describe("weighting reads her state", () => {
  it("makes dizziness far likelier when she is dehydrated and drained", () => {
    const dry = { ...MID_STATS, hydration: 10, energy: 15 };
    const fine = { ...MID_STATS, hydration: 90, energy: 90 };
    const count = (stats: Record<StatName, number>) =>
      Array.from({ length: 400 }, () => rollEvent(ctx({ stats }))?.key).filter((k) => k === "dizzy")
        .length;
    expect(count(dry)).toBeGreaterThan(count(fine));
  });

  it("makes loneliness likelier with no partner than with a supportive one", () => {
    const count = (over: Partial<EventContext>) =>
      Array.from({ length: 400 }, () => rollEvent(ctx(over))?.key).filter(
        (k) => k === "mood_lonely" || k === "needs_them",
      ).length;
    expect(count({ partnerLinked: false })).toBeGreaterThan(
      count({ partnerLinked: true, partnerSupport: 95 }),
    );
  });

  it("does not offer late-pregnancy moments early in the pregnancy", () => {
    const early = Array.from({ length: 600 }, () => rollEvent(ctx({ trimester: 1, week: 8 }))?.key);
    for (const forbidden of ["swollen_feet", "braxton_hicks", "bag_thought", "baby_hiccups"]) {
      expect(early, forbidden).not.toContain(forbidden);
    }
  });

  it("cannot report a kick before she could possibly feel one", () => {
    const early = Array.from(
      { length: 600 },
      () => rollEvent(ctx({ trimester: 1, week: 10 }))?.key,
    );
    expect(early).not.toContain("baby_kick");
    expect(early).not.toContain("baby_roll");
  });

  it("lets her mood tilt what comes next", () => {
    const count = (mood: EventContext["mood"]) =>
      Array.from({ length: 400 }, () => rollEvent(ctx({ mood }))?.key).filter((k) =>
        ["needs_them", "wants_touch"].includes(k ?? ""),
      ).length;
    expect(count("lonely")).toBeGreaterThan(count("happy"));
  });
});

describe("preferences", () => {
  it("never rolls a category she has switched off", () => {
    const disabled = new Set(["mood", "sickness", "craving"] as const);
    for (let i = 0; i < 500; i++) {
      const event = rollEvent(ctx({ disabled: disabled as EventContext["disabled"] }));
      expect(event).not.toBeNull();
      expect(disabled.has(event!.category as never)).toBe(false);
    }
  });

  it("returns null rather than inventing a moment when everything is off", () => {
    expect(rollEvent(ctx({ disabled: new Set(EVENT_CATEGORIES) }))).toBeNull();
  });
});
