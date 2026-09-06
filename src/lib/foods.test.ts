// Food catalogue integrity.
//
// The foods are plain data, which is exactly why they need a test: a typo in a
// craving pool key means ensureCraving silently picks a random food instead of
// the one it meant, and a duplicate key means foodByKey returns the wrong item
// forever. Neither would throw.

import { describe, it, expect } from "vitest";
import {
  FOOD_ITEMS,
  FOOD_CATEGORIES,
  FOOD_CATEGORY_LABELS,
  CRAVING_POOL,
  foodByKey,
  foodForCraving,
} from "./foods";

describe("catalogue", () => {
  it("has no duplicate keys", () => {
    const keys = FOOD_ITEMS.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("has no duplicate display names", () => {
    const names = FOOD_ITEMS.map((f) => f.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("puts every item in a real category, and labels every category", () => {
    for (const food of FOOD_ITEMS) {
      expect(FOOD_CATEGORIES, food.key).toContain(food.category);
    }
    for (const category of FOOD_CATEGORIES) {
      expect(FOOD_CATEGORY_LABELS[category], category).toBeTruthy();
    }
  });

  it("fills every category the feedback board asks for", () => {
    // The board lists eight groups; an empty one renders as a missing section
    // on the Nutrition screen.
    for (const category of FOOD_CATEGORIES) {
      const items = FOOD_ITEMS.filter((f) => f.category === category);
      expect(items.length, `${category} is empty`).toBeGreaterThan(0);
    }
    // Everything except pica (which is deliberately just corn starch and chalk)
    // should have enough variety that the list does not read as a stub.
    for (const category of FOOD_CATEGORIES.filter((c) => c !== "pica")) {
      const items = FOOD_ITEMS.filter((f) => f.category === category);
      expect(items.length, `${category} only has ${items.length}`).toBeGreaterThanOrEqual(6);
    }
  });

  it("gives every food searchable craving tags and a note", () => {
    for (const food of FOOD_ITEMS) {
      expect(food.cravingTags.length, food.key).toBeGreaterThan(0);
      expect(food.note.length, food.key).toBeGreaterThan(0);
      for (const tag of food.cravingTags) {
        expect(tag, food.key).toBe(tag.toLowerCase());
      }
    }
  });

  it("keeps every stat change inside a sane single-serving range", () => {
    for (const food of FOOD_ITEMS) {
      for (const [stat, delta] of Object.entries(food.deltas)) {
        expect(Math.abs(delta as number), `${food.key}.${stat}`).toBeLessThanOrEqual(40);
      }
      expect(food.cravingRelief, food.key).toBeGreaterThan(0);
      expect(food.cravingRelief, food.key).toBeLessThanOrEqual(40);
    }
  });
});

describe("craving pools", () => {
  it("only names foods that actually exist", () => {
    for (const [trimester, keys] of Object.entries(CRAVING_POOL)) {
      for (const key of keys) {
        expect(foodByKey(key), `trimester ${trimester}: ${key}`).toBeDefined();
      }
    }
  });

  it("has no repeats inside a trimester", () => {
    for (const [trimester, keys] of Object.entries(CRAVING_POOL)) {
      expect(new Set(keys).size, `trimester ${trimester}`).toBe(keys.length);
    }
  });

  it("offers enough variety that the same craving does not keep returning", () => {
    for (const [trimester, keys] of Object.entries(CRAVING_POOL)) {
      expect(keys.length, `trimester ${trimester}`).toBeGreaterThanOrEqual(15);
    }
  });

  it("keeps pica out of the first trimester and available later", () => {
    const pica = FOOD_ITEMS.filter((f) => f.category === "pica").map((f) => f.key);
    for (const key of pica) expect(CRAVING_POOL[1]).not.toContain(key);
    expect(pica.some((k) => CRAVING_POOL[3].includes(k))).toBe(true);
  });
});

describe("lookup", () => {
  it("matches a craving phrase to the food it names", () => {
    expect(foodForCraving("pickles").key).toBe("pickles");
    expect(foodForCraving("ice cream").key).toBe("ice_cream");
    expect(foodForCraving("She is craving pancakes").key).toBe("pancakes");
  });

  it("still returns something for a craving nothing matches", () => {
    expect(foodForCraving("moon rocks")).toBeDefined();
  });

  it("returns undefined for a key that is not a food", () => {
    expect(foodByKey("not_a_food")).toBeUndefined();
  });
});

describe("craving matching is specific, not first-in-array", () => {
  // Tags deliberately overlap. These are the pairs where catalogue order used
  // to win and hand her the wrong food's stats.
  it.each([
    ["pickles", "pickles"],
    ["pickle chips", "pickle_chips"],
    ["toast", "toast"],
    ["french toast", "french_toast"],
    ["jam toast", "jam_toast"],
    ["orange", "orange"],
    ["orange juice", "juice"],
    ["ice cream", "ice_cream"],
    ["ice chips", "ice_chips"],
    ["chocolate bar", "chocolate_bar"],
    ["cheesecake", "cheesecake"],
    ["strawberries", "strawberries"],
  ])("resolves %s to %s", (phrase, key) => {
    expect(foodForCraving(phrase).key).toBe(key);
  });

  it("resolves every craving-pool food back to itself by name", () => {
    const pooled = new Set(Object.values(CRAVING_POOL).flat());
    for (const key of pooled) {
      const food = foodByKey(key)!;
      expect(foodForCraving(food.name).key, food.name).toBe(key);
    }
  });
});
