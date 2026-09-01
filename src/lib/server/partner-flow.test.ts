// End-to-end Mom ↔ Partner flow against a real Postgres.
//
// Skips itself unless TEST_DATABASE_URL is set, because it creates and deletes
// rows. Point it at a scratch database — never at one with players in it:
//
//   TEST_DATABASE_URL=postgres://... npx vitest run partner-flow
//
// Every fixture avatar is created inside this file and removed in afterAll, and
// the hud_users cascade takes their pregnancies, links, events and requests
// with them.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";

const TEST_URL = process.env.TEST_DATABASE_URL;
if (TEST_URL) process.env.DATABASE_URL = TEST_URL;

const describeDb = TEST_URL ? describe : describe.skip;

const DAY = 86_400_000;
const createdUserIds: string[] = [];

// Imported lazily so the module graph never opens a pool when skipping.
type Game = typeof import("./game");
type Partner = typeof import("./partner");
type Db = typeof import("./db");
let game: Game;
let partner: Partner;
let dbmod: Db;

async function makeMom(name = "Test Mom") {
  const user = await game.getOrCreateUser(randomUUID(), `${name} ${randomUUID().slice(0, 8)}`, "mom");
  createdUserIds.push(user.id);
  const preg = await game.ensureActivePregnancy(user.id);
  // Setup must be complete for the labor engine to consider the pregnancy live.
  await dbmod
    .db()
    .query(`update pregnancies set setup_complete = true, duration_days = 30 where id = $1`, [
      preg.id,
    ]);
  return { user, pregnancyId: preg.id as string, code: preg.partner_code as string };
}

async function makePartner(name = "Test Partner") {
  const user = await game.getOrCreateUser(
    randomUUID(),
    `${name} ${randomUUID().slice(0, 8)}`,
    "partner",
  );
  createdUserIds.push(user.id);
  return user;
}

/** Pair them the way the LSL pairing route does, then have Mom accept. */
async function link(mom: Awaited<ReturnType<typeof makeMom>>, partnerUser: { id: string; avatar_name: string }) {
  const result = await partner.requestLink({
    pregnancyId: mom.pregnancyId,
    momId: mom.user.id,
    partnerUserId: partnerUser.id,
    partnerName: partnerUser.avatar_name,
    momName: mom.user.avatar_name,
  });
  if (result.status === "pending") {
    await game.performAction(
      mom.user,
      "partner_link_respond",
      { linkId: result.linkId, accept: true },
      "web",
    );
  }
  return result;
}

/** Put the pregnancy at a chosen number of minutes into its own labor. */
async function forceLaborAt(pregnancyId: string, minutesIn: number) {
  const { rows } = await dbmod.db().query(`select duration_days from pregnancies where id = $1`, [
    pregnancyId,
  ]);
  const days = Number(rows[0].duration_days);
  const onsetFrac = 0.98;
  // conceived_at such that (now - conceived)/total == onsetFrac + minutesIn
  const elapsedMs = onsetFrac * days * DAY + minutesIn * 60_000;
  await dbmod.db().query(
    `update pregnancies
        set conceived_at = $2, labor_onset_frac = $3, labor_plan = $4, updated_at = now()
      where id = $1`,
    [
      pregnancyId,
      new Date(Date.now() - elapsedMs).toISOString(),
      onsetFrac,
      JSON.stringify({
        v: 1,
        totalMinutes: 100,
        waterAt: 40,
        hospitalAt: 40,
        active: 30,
        transition: 70,
        pushing: 88,
      }),
    ],
  );
}

async function pregRow(pregnancyId: string) {
  const { rows } = await dbmod.db().query(`select * from pregnancies where id = $1`, [pregnancyId]);
  return rows[0];
}

async function eventTypes(pregnancyId: string): Promise<string[]> {
  const { rows } = await dbmod
    .db()
    .query(`select type from pregnancy_events where pregnancy_id = $1`, [pregnancyId]);
  return rows.map((r) => r.type as string);
}

beforeAll(async () => {
  if (!TEST_URL) return;
  game = await import("./game");
  partner = await import("./partner");
  dbmod = await import("./db");
});

afterAll(async () => {
  if (!TEST_URL || !dbmod) return;
  if (createdUserIds.length) {
    await dbmod.db().query(`delete from hud_users where id = any($1::uuid[])`, [createdUserIds]);
  }
  await dbmod.db().end?.();
});

// ---------------------------------------------------------------------------

describeDb("pairing", () => {
  it("a redeemed code creates a pending link, not access", async () => {
    const mom = await makeMom();
    const dad = await makePartner();
    const result = await partner.requestLink({
      pregnancyId: mom.pregnancyId,
      momId: mom.user.id,
      partnerUserId: dad.id,
      partnerName: dad.avatar_name,
      momName: mom.user.avatar_name,
    });
    expect(result.status).toBe("pending");
    // Until she accepts, the partner resolves to no pregnancy at all.
    expect(await game.pregnancyForUser(dad)).toBeNull();
  });

  it("accepting links them and keeps pregnancies.partner_user_id in sync", async () => {
    const mom = await makeMom();
    const dad = await makePartner();
    await link(mom, dad);

    const linked = await game.pregnancyForUser(dad);
    expect(linked?.id).toBe(mom.pregnancyId);
    expect((await pregRow(mom.pregnancyId)).partner_user_id).toBe(dad.id);
  });

  it("declining leaves the partner with nothing", async () => {
    const mom = await makeMom();
    const dad = await makePartner();
    const result = await partner.requestLink({
      pregnancyId: mom.pregnancyId,
      momId: mom.user.id,
      partnerUserId: dad.id,
      partnerName: dad.avatar_name,
      momName: mom.user.avatar_name,
    });
    const response = await game.performAction(
      mom.user,
      "partner_link_respond",
      { linkId: result.linkId, accept: false },
      "web",
    );
    expect(response.ok).toBe(true);
    expect(await game.pregnancyForUser(dad)).toBeNull();
  });

  it("refuses a second partner while one is already linked", async () => {
    const mom = await makeMom();
    const first = await makePartner();
    const second = await makePartner();
    await link(mom, first);

    await expect(
      partner.requestLink({
        pregnancyId: mom.pregnancyId,
        momId: mom.user.id,
        partnerUserId: second.id,
        partnerName: second.avatar_name,
        momName: mom.user.avatar_name,
      }),
    ).rejects.toThrow(/already has a partner/i);
  });

  it("a removed partner loses access immediately and can reconnect later", async () => {
    const mom = await makeMom();
    const dad = await makePartner();
    await link(mom, dad);
    expect(await game.pregnancyForUser(dad)).not.toBeNull();

    await game.performAction(mom.user, "partner_remove", {}, "web");
    expect(await game.pregnancyForUser(dad)).toBeNull();

    // Reconnecting someone she linked before does not need a second approval.
    const again = await link(mom, dad);
    expect(again.status).toBe("active");
    expect(await game.pregnancyForUser(dad)).not.toBeNull();
  });
});

describeDb("access control", () => {
  it("an unlinked partner sees no pregnancy", async () => {
    const stranger = await makePartner("Stranger");
    expect(await game.pregnancyForUser(stranger)).toBeNull();
  });

  it("a partner cannot reach a pregnancy that is not theirs", async () => {
    const momA = await makeMom("Mom A");
    const momB = await makeMom("Mom B");
    const dad = await makePartner();
    await link(momA, dad);

    // Even naming momB's pregnancy explicitly, every path resolves via the
    // caller's own active link — so he lands on momA's pregnancy or nothing.
    const seen = await game.pregnancyForUser(dad);
    expect(seen?.id).toBe(momA.pregnancyId);
    expect(seen?.id).not.toBe(momB.pregnancyId);

    const bagWrite = await game.performAction(
      dad,
      "bag_item",
      { itemKey: "pacifier", checked: true },
      "web",
    );
    expect(bagWrite.ok).toBe(true);
    const { rows } = await dbmod
      .db()
      .query(`select pregnancy_id from hospital_bag_items where item_key = 'pacifier'`);
    expect(rows.map((r) => r.pregnancy_id)).not.toContain(momB.pregnancyId);
  });

  it("rejects a forged request id", async () => {
    const mom = await makeMom();
    const dad = await makePartner();
    await link(mom, dad);
    const forged = await game.performAction(
      mom.user,
      "request_respond",
      { requestId: randomUUID(), accept: true },
      "web",
    );
    expect(forged.ok).toBe(false);
  });

  it("rejects a forged milestone id", async () => {
    const mom = await makeMom();
    const result = await game.performAction(
      mom.user,
      "milestone_celebrate",
      { milestoneId: randomUUID() },
      "web",
    );
    expect(result.first).toBeFalsy();
  });

  it("only Mom may change permissions or remove the partner", async () => {
    const mom = await makeMom();
    const dad = await makePartner();
    await link(mom, dad);

    expect((await game.performAction(dad, "partner_permissions", {}, "web")).ok).toBe(false);
    expect((await game.performAction(dad, "partner_remove", {}, "web")).ok).toBe(false);
    expect((await pregRow(mom.pregnancyId)).partner_user_id).toBe(dad.id);
  });
});

describeDb("labor is the engine's, not a button's", () => {
  it("exposes no action a partner can use to start or advance labor", async () => {
    const mom = await makeMom();
    const dad = await makePartner();
    await link(mom, dad);

    for (const attempt of ["water_break", "birth", "labor_start"]) {
      const result = await game.performAction(dad, attempt, {}, "web");
      expect(result.ok, attempt).toBe(false);
    }
    const row = await pregRow(mom.pregnancyId);
    expect(row.labor_phase).toBe("none");
    expect(row.water_broken_at).toBeNull();
    expect(row.birth_at).toBeNull();
    expect(row.status).toBe("active");
  });

  it("Mom cannot press her way into labor either", async () => {
    const mom = await makeMom();
    for (const attempt of ["water_break", "birth"]) {
      expect((await game.performAction(mom.user, attempt, {}, "web")).ok, attempt).toBe(false);
    }
    // Contractions before labor is a roleplay no-op, not a state change.
    const early = await game.performAction(mom.user, "contractions", {}, "web");
    expect(early.ok).toBe(false);
    expect((await pregRow(mom.pregnancyId)).labor_phase).toBe("none");
  });

  it("starts labor on its own once the pregnancy reaches its drawn onset", async () => {
    const mom = await makeMom();
    const dad = await makePartner();
    await link(mom, dad);

    await forceLaborAt(mom.pregnancyId, 5);
    await game.getDashboardState(mom.user);

    const row = await pregRow(mom.pregnancyId);
    expect(row.labor_phase).toBe("early");
    expect(row.labor_stage).toBe("contractions");
    expect(row.contractions_started_at).not.toBeNull();
    expect(await eventTypes(mom.pregnancyId)).toContain("LABOR_STARTED");
  });

  it("walks the phases in order rather than jumping to delivered", async () => {
    const mom = await makeMom();
    await forceLaborAt(mom.pregnancyId, 95);
    await game.getDashboardState(mom.user);

    const types = await eventTypes(mom.pregnancyId);
    expect(types).toContain("LABOR_STARTED");
    expect(types).toContain("WATER_BROKE");
    expect(types).toContain("BIRTH_STARTED");
    expect((await pregRow(mom.pregnancyId)).labor_phase).toBe("pushing");
  });

  it("delivers, marks the pregnancy delivered, and announces it once", async () => {
    const mom = await makeMom();
    const dad = await makePartner();
    await link(mom, dad);

    await forceLaborAt(mom.pregnancyId, 120);
    await game.getDashboardState(mom.user);
    // A second read must not produce a second birth.
    await game.getDashboardState(mom.user);
    await game.getDashboardState(dad);

    const row = await pregRow(mom.pregnancyId);
    expect(row.labor_phase).toBe("delivered");
    expect(row.status).toBe("delivered");
    expect(row.birth_at).not.toBeNull();

    const births = (await eventTypes(mom.pregnancyId)).filter((t) => t === "BABY_BORN");
    expect(births).toHaveLength(1);
  });

  it("is safe to run concurrently — parallel reads still deliver exactly once", async () => {
    const mom = await makeMom();
    const dad = await makePartner();
    await link(mom, dad);
    await forceLaborAt(mom.pregnancyId, 120);

    await Promise.all([
      game.getDashboardState(mom.user),
      game.getDashboardState(dad),
      game.getDashboardState(mom.user),
      game.getDashboardState(dad),
    ]);

    const births = (await eventTypes(mom.pregnancyId)).filter((t) => t === "BABY_BORN");
    expect(births).toHaveLength(1);
    const waters = (await eventTypes(mom.pregnancyId)).filter((t) => t === "WATER_BROKE");
    expect(waters).toHaveLength(1);
  });

  it("both HUDs read the same labor state", async () => {
    const mom = await makeMom();
    const dad = await makePartner();
    await link(mom, dad);
    await forceLaborAt(mom.pregnancyId, 50);

    const hers = (await game.getDashboardState(mom.user)) as never as {
      pregnancy: { labor: { phase: string; intensity: number; waterBroken: boolean } };
    };
    const his = (await game.getDashboardState(dad)) as never as typeof hers;

    expect(his.pregnancy.labor.phase).toBe(hers.pregnancy.labor.phase);
    expect(his.pregnancy.labor.waterBroken).toBe(hers.pregnancy.labor.waterBroken);
    expect(hers.pregnancy.labor.waterBroken).toBe(true);
  });
});

describeDb("interaction requests", () => {
  it("a consent action becomes a request, and lands only once she accepts", async () => {
    const mom = await makeMom();
    const dad = await makePartner();
    await link(mom, dad);

    const before = await game.getStatsWithDecay(mom.user.id, 2);
    const asked = await game.performAction(dad, "hug", {}, "web");
    expect(asked.ok).toBe(true);

    const during = await game.getStatsWithDecay(mom.user.id, 2);
    expect(during.comfort).toBeCloseTo(before.comfort, 0);

    const inbox = await partner.pendingRequestsFor(mom.user.id, mom.pregnancyId);
    expect(inbox).toHaveLength(1);
    expect(inbox[0].actionType).toBe("hug");

    const accepted = await game.performAction(
      mom.user,
      "request_respond",
      { requestId: inbox[0].id, accept: true },
      "web",
    );
    expect(accepted.ok).toBe(true);
    const after = await game.getStatsWithDecay(mom.user.id, 2);
    expect(after.comfort).toBeGreaterThan(before.comfort);
  });

  it("declining leaves her untouched", async () => {
    const mom = await makeMom();
    const dad = await makePartner();
    await link(mom, dad);

    const before = await game.getStatsWithDecay(mom.user.id, 2);
    await game.performAction(dad, "kiss", {}, "web");
    const inbox = await partner.pendingRequestsFor(mom.user.id, mom.pregnancyId);
    await game.performAction(
      mom.user,
      "request_respond",
      { requestId: inbox[0].id, accept: false },
      "web",
    );
    const after = await game.getStatsWithDecay(mom.user.id, 2);
    expect(after.mood).toBeCloseTo(before.mood, 0);
    expect(await partner.pendingRequestsFor(mom.user.id, mom.pregnancyId)).toHaveLength(0);
  });

  it("a double tap does not stack two prompts on her screen", async () => {
    const mom = await makeMom();
    const dad = await makePartner();
    await link(mom, dad);

    await Promise.all([
      game.performAction(dad, "hug", {}, "web"),
      game.performAction(dad, "hug", {}, "web"),
      game.performAction(dad, "hug", {}, "web"),
    ]);
    expect(await partner.pendingRequestsFor(mom.user.id, mom.pregnancyId)).toHaveLength(1);
  });

  it("answering twice only applies the effect once", async () => {
    const mom = await makeMom();
    const dad = await makePartner();
    await link(mom, dad);

    await game.performAction(dad, "hug", {}, "web");
    const inbox = await partner.pendingRequestsFor(mom.user.id, mom.pregnancyId);
    const first = await game.performAction(
      mom.user,
      "request_respond",
      { requestId: inbox[0].id, accept: true },
      "web",
    );
    const second = await game.performAction(
      mom.user,
      "request_respond",
      { requestId: inbox[0].id, accept: true },
      "web",
    );
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
  });

  it("an expired request can no longer be accepted", async () => {
    const mom = await makeMom();
    const dad = await makePartner();
    await link(mom, dad);

    await game.performAction(dad, "hug", {}, "web");
    const inbox = await partner.pendingRequestsFor(mom.user.id, mom.pregnancyId);
    await dbmod
      .db()
      .query(
        `update pregnancy_interaction_requests set expires_at = now() - interval '1 minute' where id = $1`,
        [inbox[0].id],
      );

    const late = await game.performAction(
      mom.user,
      "request_respond",
      { requestId: inbox[0].id, accept: true },
      "web",
    );
    expect(late.ok).toBe(false);
    expect(await partner.pendingRequestsFor(mom.user.id, mom.pregnancyId)).toHaveLength(0);
  });

  it("an auto-accepted action skips the prompt and lands immediately", async () => {
    const mom = await makeMom();
    const dad = await makePartner();
    await link(mom, dad);
    // partner_water is auto-accept by default.
    const before = await game.getStatsWithDecay(mom.user.id, 2);
    const result = await game.performAction(dad, "partner_water", {}, "web");
    expect(result.ok).toBe(true);
    expect(await partner.pendingRequestsFor(mom.user.id, mom.pregnancyId)).toHaveLength(0);
    const after = await game.getStatsWithDecay(mom.user.id, 2);
    expect(after.hydration).toBeGreaterThan(before.hydration);
  });

  it("honours Mom flipping an action to ask-first", async () => {
    const mom = await makeMom();
    const dad = await makePartner();
    await link(mom, dad);

    await game.performAction(
      mom.user,
      "partner_permissions",
      { permissions: { autoAccept: { partner_water: false } } },
      "web",
    );
    await game.performAction(dad, "partner_water", {}, "web");
    expect(await partner.pendingRequestsFor(mom.user.id, mom.pregnancyId)).toHaveLength(1);
  });

  it("removing the partner cancels whatever they had in flight", async () => {
    const mom = await makeMom();
    const dad = await makePartner();
    await link(mom, dad);
    await game.performAction(dad, "hug", {}, "web");

    await game.performAction(mom.user, "partner_remove", {}, "web");
    expect(await partner.pendingRequestsFor(mom.user.id, mom.pregnancyId)).toHaveLength(0);
  });
});

describeDb("permissions", () => {
  it("a switched-off category blocks the action outright", async () => {
    const mom = await makeMom();
    const dad = await makePartner();
    await link(mom, dad);

    await game.performAction(
      mom.user,
      "partner_permissions",
      { permissions: { allowPhysical: false } },
      "web",
    );
    const blocked = await game.performAction(dad, "hug", {}, "web");
    expect(blocked.ok).toBe(false);
    expect(await partner.pendingRequestsFor(mom.user.id, mom.pregnancyId)).toHaveLength(0);
  });

  it("blocks partner actions server-side, not just in the UI", async () => {
    const mom = await makeMom();
    const dad = await makePartner();
    await link(mom, dad);

    await game.performAction(
      mom.user,
      "partner_permissions",
      { permissions: { allowComfort: false, allowHospitalBag: false, viewMilestones: false } },
      "web",
    );

    // These predate the gated block and are reachable straight from the API,
    // so the server has to refuse them itself.
    for (const attempt of ["support", "partner_message", "partner_status", "bag_rez"]) {
      expect((await game.performAction(dad, attempt, {}, "web")).ok, attempt).toBe(false);
    }
    const bag = await game.performAction(
      dad,
      "bag_item",
      { itemKey: "pacifier", checked: true },
      "web",
    );
    expect(bag.ok).toBe(false);
    expect((await partner.hospitalBag(mom.pregnancyId)).packed).toBe(0);
  });

  it("check-on-her hides what she has made private", async () => {
    const mom = await makeMom();
    const dad = await makePartner();
    await link(mom, dad);

    await game.performAction(
      mom.user,
      "partner_permissions",
      { permissions: { viewWeek: false, viewMood: false, viewWellness: false, viewLabor: false } },
      "web",
    );
    const status = (await game.performAction(dad, "partner_status", {}, "web")) as {
      summary?: { week: number | null; mood: string | null; labor: string };
    };
    expect(status.summary?.week).toBeNull();
    expect(status.summary?.mood).toBeNull();
    expect(status.summary?.labor).toBe("Private");
  });
});

describeDb("availability", () => {
  it("ice chips are refused before labor and allowed during it", async () => {
    const mom = await makeMom();
    const dad = await makePartner();
    await link(mom, dad);

    expect((await game.performAction(dad, "partner_ice_chips", {}, "web")).ok).toBe(false);

    await forceLaborAt(mom.pregnancyId, 10);
    await game.getDashboardState(mom.user);
    expect((await game.performAction(dad, "partner_ice_chips", {}, "web")).ok).toBe(true);
  });

  it("water is refused during labor — ice chips only", async () => {
    const mom = await makeMom();
    const dad = await makePartner();
    await link(mom, dad);
    await forceLaborAt(mom.pregnancyId, 10);
    await game.getDashboardState(mom.user);

    const result = await game.performAction(dad, "partner_water", {}, "web");
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/ice chips/i);
  });

  it("feeling the kick needs a kick to have actually happened", async () => {
    const mom = await makeMom();
    const dad = await makePartner();
    await link(mom, dad);

    expect((await game.performAction(dad, "feel_baby_kick", {}, "web")).ok).toBe(false);

    await game.performAction(mom.user, "feel_kick", {}, "web");
    const asked = await game.performAction(dad, "feel_baby_kick", {}, "web");
    expect(asked.ok).toBe(true);

    const inbox = await partner.pendingRequestsFor(mom.user.id, mom.pregnancyId);
    expect(inbox[0].actionType).toBe("feel_baby_kick");

    // Sharing a kick must not manufacture a new one.
    const before = await dbmod
      .db()
      .query(`select count(*)::int n from kick_events where pregnancy_id = $1`, [mom.pregnancyId]);
    await game.performAction(
      mom.user,
      "request_respond",
      { requestId: inbox[0].id, accept: true },
      "web",
    );
    const after = await dbmod
      .db()
      .query(`select count(*)::int n from kick_events where pregnancy_id = $1`, [mom.pregnancyId]);
    expect(after.rows[0].n).toBe(before.rows[0].n);
  });

  it("birth reactions only unlock while she is pushing", async () => {
    const mom = await makeMom();
    const dad = await makePartner();
    await link(mom, dad);

    expect((await game.performAction(dad, "partner_faint", {}, "web")).ok).toBe(false);

    await forceLaborAt(mom.pregnancyId, 90);
    await game.getDashboardState(mom.user);
    expect((await pregRow(mom.pregnancyId)).labor_phase).toBe("pushing");
    expect((await game.performAction(dad, "partner_faint", {}, "web")).ok).toBe(true);
  });
});

describeDb("shared hospital bag", () => {
  it("what one of them packs, the other sees", async () => {
    const mom = await makeMom();
    const dad = await makePartner();
    await link(mom, dad);

    await game.performAction(dad, "bag_item", { itemKey: "baby_outfit", checked: true }, "web");
    const hers = await partner.hospitalBag(mom.pregnancyId);
    const outfit = hers.items.find((i) => i.key === "baby_outfit");
    expect(outfit?.checked).toBe(true);
    expect(outfit?.checkedBy).toBe(dad.avatar_name);

    await game.performAction(mom.user, "bag_item", { itemKey: "car_seat", checked: true }, "web");
    const his = await partner.hospitalBag(mom.pregnancyId);
    expect(his.packed).toBe(2);
    expect(his.items.find((i) => i.key === "car_seat")?.checkedBy).toBe(mom.user.avatar_name);
  });

  it("packing the same item twice is a no-op, not a second event", async () => {
    const mom = await makeMom();
    await game.performAction(mom.user, "bag_item", { itemKey: "pacifier", checked: true }, "web");
    await game.performAction(mom.user, "bag_item", { itemKey: "pacifier", checked: true }, "web");
    const updates = (await eventTypes(mom.pregnancyId)).filter(
      (t) => t === "HOSPITAL_BAG_UPDATED",
    );
    expect(updates).toHaveLength(1);
  });

  it("rejects an item that is not on the list", async () => {
    const mom = await makeMom();
    const result = await game.performAction(
      mom.user,
      "bag_item",
      { itemKey: "a_whole_horse", checked: true },
      "web",
    );
    expect(result.ok).toBe(false);
    expect((await partner.hospitalBag(mom.pregnancyId)).packed).toBe(0);
  });

  it("celebrates once the whole bag is packed", async () => {
    const mom = await makeMom();
    const { HOSPITAL_BAG_ITEMS } = await import("../partner");
    for (const item of HOSPITAL_BAG_ITEMS) {
      await game.performAction(mom.user, "bag_item", { itemKey: item.key, checked: true }, "web");
    }
    const bag = await partner.hospitalBag(mom.pregnancyId);
    expect(bag.ready).toBe(true);
    expect(bag.percent).toBe(100);
    const milestones = await partner.milestonesFor(mom.pregnancyId);
    expect(milestones.map((m) => m.key)).toContain("hospital_bag_ready");
  });
});

describeDb("milestones", () => {
  it("celebrating is idempotent per person", async () => {
    const mom = await makeMom();
    const dad = await makePartner();
    await link(mom, dad);

    const milestones = await partner.milestonesFor(mom.pregnancyId);
    const linkedMilestone = milestones.find((m) => m.key === "pregnancy_linked");
    expect(linkedMilestone).toBeTruthy();

    const first = await game.performAction(
      dad,
      "milestone_celebrate",
      { milestoneId: linkedMilestone!.id },
      "web",
    );
    const second = await game.performAction(
      dad,
      "milestone_celebrate",
      { milestoneId: linkedMilestone!.id },
      "web",
    );
    expect(first.message).toMatch(/celebrated/i);
    expect(second.message).toMatch(/already/i);
  });
});

describeDb("offline catch-up", () => {
  it("a partner who was away reads the whole run of events on return", async () => {
    const mom = await makeMom();
    const dad = await makePartner();
    await link(mom, dad);

    await game.performAction(mom.user, "feel_kick", {}, "web");
    await forceLaborAt(mom.pregnancyId, 95);
    await game.getDashboardState(mom.user);

    const state = (await game.getDashboardState(dad)) as never as {
      sharedEvents: { type: string }[];
    };
    const types = state.sharedEvents.map((e) => e.type);
    expect(types).toContain("BABY_KICKED");
    expect(types).toContain("LABOR_STARTED");
    expect(types).toContain("WATER_BROKE");
  });
});

describeDb("backward compatibility", () => {
  it("a pregnancy with no partner works exactly as before", async () => {
    const mom = await makeMom();
    const state = (await game.getDashboardState(mom.user)) as never as {
      partner: { linked: boolean; code: string };
      pregnancy: { week: number };
      hospitalBag: { total: number };
    };
    expect(state.partner.linked).toBe(false);
    expect(state.partner.code).toHaveLength(6);
    expect(state.pregnancy.week).toBeGreaterThanOrEqual(0);
    expect(state.hospitalBag.total).toBe(18);

    const care = await game.performAction(mom.user, "drink_water", {}, "web");
    expect(care.ok).toBe(true);
  });

  it("a pregnancy that has not finished setup never goes into labor", async () => {
    const mom = await makeMom();
    await dbmod
      .db()
      .query(`update pregnancies set setup_complete = false where id = $1`, [mom.pregnancyId]);
    await forceLaborAt(mom.pregnancyId, 200);
    await game.getDashboardState(mom.user);
    expect((await pregRow(mom.pregnancyId)).labor_phase).toBe("none");
  });
});
