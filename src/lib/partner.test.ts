// Permission resolution and the partner action catalogue. These are the rules
// that decide what a partner may see and do, so they are worth pinning down
// without needing a database.

import { describe, it, expect } from "vitest";
import { resolvePermissions } from "./server/partner";
import {
  PARTNER_ACTIONS,
  DEFAULT_PARTNER_PERMISSIONS,
  HOSPITAL_BAG_ITEMS,
  BAG_ITEM_KEYS,
  PERMISSION_GROUPS,
} from "./partner";

describe("resolvePermissions", () => {
  it("falls back to the defaults when nothing has been configured", () => {
    const perms = resolvePermissions(null, null);
    for (const [key, value] of Object.entries(DEFAULT_PARTNER_PERMISSIONS)) {
      expect(perms[key as keyof typeof DEFAULT_PARTNER_PERMISSIONS]).toBe(value);
    }
  });

  it("keeps the private journal private by default", () => {
    expect(resolvePermissions(null, null).viewJournal).toBe(false);
  });

  it("carries over the legacy partnerPermissions block rather than resetting it", () => {
    const perms = resolvePermissions(null, {
      momWellness: false,
      appointments: false,
      journalMemories: true,
      babyUpdates: false,
    });
    expect(perms.viewWellness).toBe(false);
    expect(perms.viewAppointments).toBe(false);
    expect(perms.viewJournal).toBe(true);
    expect(perms.viewKicks).toBe(false);
    expect(perms.viewStage).toBe(false);
  });

  it("lets the link override the legacy block", () => {
    const perms = resolvePermissions({ viewWellness: true }, { momWellness: false });
    expect(perms.viewWellness).toBe(true);
  });

  it("ignores junk and unknown keys instead of trusting them", () => {
    const perms = resolvePermissions(
      { viewWeek: "yes", notARealPermission: true, viewMood: false },
      null,
    );
    expect(perms.viewWeek).toBe(true); // string ignored, default kept
    expect(perms.viewMood).toBe(false);
    expect((perms as Record<string, unknown>).notARealPermission).toBeUndefined();
  });

  it("asks before physical contact but not before fetching and carrying", () => {
    const { autoAccept } = resolvePermissions(null, null);
    expect(autoAccept.hug).toBe(false);
    expect(autoAccept.kiss).toBe(false);
    expect(autoAccept.feel_baby_kick).toBe(false);
    expect(autoAccept.partner_ice_chips).toBe(true);
    expect(autoAccept.partner_water).toBe(true);
  });

  it("lets Mom switch any consent action to automatic", () => {
    const { autoAccept } = resolvePermissions({ autoAccept: { hug: true } }, null);
    expect(autoAccept.hug).toBe(true);
    expect(autoAccept.kiss).toBe(false);
  });

  it("refuses autoAccept entries for actions that do not exist", () => {
    const { autoAccept } = resolvePermissions({ autoAccept: { drop_the_baby: true } }, null);
    expect(autoAccept.drop_the_baby).toBeUndefined();
  });
});

describe("partner action catalogue", () => {
  it("gives every action a permission that actually exists", () => {
    for (const def of Object.values(PARTNER_ACTIONS)) {
      expect(Object.keys(DEFAULT_PARTNER_PERMISSIONS)).toContain(def.permission);
    }
  });

  it("keys every entry by its own action name", () => {
    for (const [key, def] of Object.entries(PARTNER_ACTIONS)) {
      expect(def.action).toBe(key);
    }
  });

  it("gives every action a reason to show when it is unavailable", () => {
    for (const def of Object.values(PARTNER_ACTIONS)) {
      expect(def.unavailable.length).toBeGreaterThan(10);
    }
  });

  it("gives every consent action the line Mom will read in her inbox", () => {
    for (const def of Object.values(PARTNER_ACTIONS)) {
      if (def.consent) expect(def.request, def.action).toBeTruthy();
    }
  });

  it("exposes no action that could advance labor", () => {
    const names = Object.keys(PARTNER_ACTIONS);
    for (const forbidden of ["water_break", "birth", "contractions", "go_to_hospital"]) {
      expect(names).not.toContain(forbidden);
    }
  });

  it("locks ice chips and birth reactions to the states they belong in", () => {
    expect(PARTNER_ACTIONS.partner_ice_chips.availability).toBe("labor");
    expect(PARTNER_ACTIONS.partner_labor_support.availability).toBe("labor");
    expect(PARTNER_ACTIONS.partner_faint.availability).toBe("birth");
    expect(PARTNER_ACTIONS.partner_vomit_react.availability).toBe("birth");
    expect(PARTNER_ACTIONS.feel_baby_kick.availability).toBe("kick");
  });
});

describe("hospital bag", () => {
  it("has the eighteen items across the three bags", () => {
    expect(HOSPITAL_BAG_ITEMS).toHaveLength(18);
    for (const group of ["Mom", "Personal", "Baby"] as const) {
      expect(HOSPITAL_BAG_ITEMS.filter((i) => i.group === group)).toHaveLength(6);
    }
  });

  it("has no duplicate keys, so the unique constraint can never collide", () => {
    expect(BAG_ITEM_KEYS.size).toBe(HOSPITAL_BAG_ITEMS.length);
  });
});

describe("permission groups", () => {
  it("surfaces every permission to Mom, so nothing is silently ungovernable", () => {
    const shown = PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => i.key)).sort();
    expect(shown).toEqual(Object.keys(DEFAULT_PARTNER_PERMISSIONS).sort());
  });
});
