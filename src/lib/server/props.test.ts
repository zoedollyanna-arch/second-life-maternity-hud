import { beforeEach, describe, expect, it, vi } from "vitest";
import { CARE_PROPS, propDeltas } from "../props";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  release: vi.fn(),
  connect: vi.fn(),
  queue: vi.fn(),
}));
vi.mock("./db", () => ({ db: () => ({ connect: mocks.connect, query: mocks.query }) }));
vi.mock("./bus", () => ({ queueCommand: mocks.queue, addNotification: vi.fn() }));
import { completeProp, requestProp } from "./props";

const useId = "1c247ecd-620a-4b5b-b119-2e4ba5bb255c";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.connect.mockResolvedValue({ query: mocks.query, release: mocks.release });
  mocks.query.mockResolvedValue({ rows: [], rowCount: 1 });
});

describe("physical care delivery", () => {
  it.each(CARE_PROPS)("requests $name without applying stats", async (prop) => {
    const result = await requestProp("mom", prop.key, false);
    expect(result.ok).toBe(true);
    expect(mocks.queue).toHaveBeenCalledWith("mom", "hud", "give_prop", { item: prop.object });
    expect(mocks.connect).not.toHaveBeenCalled();
    expect(Object.keys(propDeltas(prop)).length).toBeGreaterThan(0);
  });
  it("rejects unknown inventory names and labor water before queuing", async () => {
    expect((await requestProp("mom", "some other object", false)).ok).toBe(false);
    expect((await requestProp("mom", "water", true)).ok).toBe(false);
    expect(mocks.queue).not.toHaveBeenCalled();
  });
});

describe("confirmed prop care", () => {
  it.each(CARE_PROPS)("saves $name receipt, stats, and log in one transaction", async (prop) => {
    expect((await completeProp("mom", "preg", prop.key, useId, false)).ok).toBe(true);
    const calls = mocks.query.mock.calls.map(([sql]) => String(sql));
    expect(calls[0]).toBe("begin");
    expect(calls.some((sql) => sql.includes("insert into prop_uses"))).toBe(true);
    const stats = mocks.query.mock.calls.find(([sql]) => String(sql).includes("update user_stats"));
    expect(stats?.[1]).toEqual(["mom", ...Object.values(propDeltas(prop))]);
    const log = mocks.query.mock.calls.find(([sql]) => String(sql).includes("insert into wellness_logs"));
    expect(log?.[1]).toEqual([
      "mom",
      "preg",
      "prop_complete",
      JSON.stringify(propDeltas(prop)),
      `Enjoyed ${prop.name}`,
    ]);
    expect(calls.at(-1)).toBe("commit");
    expect(mocks.release).toHaveBeenCalledOnce();
    expect(mocks.queue).not.toHaveBeenCalled(); // no second drinking/eating animation
  });
  it("acknowledges a retry without updating stats or logging twice, even after labor starts", async () => {
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes("insert into prop_uses")) return { rows: [], rowCount: 0 };
      if (sql.startsWith("select prop_key")) return { rows: [{ prop_key: "water" }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });
    expect((await completeProp("mom", "preg", "water", useId, true)).ok).toBe(true);
    expect(mocks.query.mock.calls.some(([sql]) => sql.includes("update user_stats"))).toBe(false);
    expect(mocks.query.mock.calls.some(([sql]) => sql.includes("insert into wellness_logs"))).toBe(
      false,
    );
  });
  it("rejects reuse of a receipt for a different prop", async () => {
    mocks.query.mockImplementation(async (sql: string) => ({
      rowCount: 0,
      rows: sql.startsWith("select prop_key") ? [{ prop_key: "water" }] : [],
    }));
    expect((await completeProp("mom", "preg", "prenatals", useId, false)).ok).toBe(false);
  });
  it("rolls back both the receipt and stats when the wellness write fails", async () => {
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes("insert into wellness_logs")) throw new Error("database interrupted");
      return { rows: [], rowCount: 1 };
    });
    await expect(completeProp("mom", "preg", "smoothie", useId, false)).rejects.toThrow(
      "database interrupted",
    );
    expect(mocks.query).toHaveBeenLastCalledWith("rollback");
    expect(mocks.query).not.toHaveBeenCalledWith("commit");
    expect(mocks.release).toHaveBeenCalledOnce();
  });
  it("rejects water if labor starts during the sip", async () => {
    expect((await completeProp("mom", "preg", "water", useId, true)).ok).toBe(false);
    expect(mocks.query).toHaveBeenLastCalledWith("rollback");
    expect(mocks.query.mock.calls.some(([sql]) => sql.includes("update user_stats"))).toBe(false);
  });
  it("rejects malformed completions before opening a transaction", async () => {
    expect((await completeProp("mom", "preg", "invalid", useId, false)).ok).toBe(false);
    expect((await completeProp("mom", "preg", "water", "", false)).ok).toBe(false);
    expect(mocks.connect).not.toHaveBeenCalled();
  });
  it("rejects a new prenatal completion during the dose window", async () => {
    mocks.query.mockImplementation(async (sql: string) => {
      if (String(sql).includes("prenatal_completed_at")) {
        return {
          rows: [{ prenatal_completed_at: new Date().toISOString(), water_completed_at: null }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 1 };
    });
    const result = await completeProp("mom", "preg", "prenatals", useId, false, 280);
    expect(result.ok).toBe(false);
    expect(mocks.query.mock.calls.some(([sql]) => String(sql).includes("update user_stats"))).toBe(
      false,
    );
    expect(mocks.query).toHaveBeenLastCalledWith("rollback");
  });
  it("still acknowledges a saved dose when the bottle retries during cooldown", async () => {
    mocks.query.mockImplementation(async (sql: string) => {
      if (String(sql).includes("insert into prop_uses")) return { rows: [], rowCount: 0 };
      if (String(sql).startsWith("select prop_key"))
        return { rows: [{ prop_key: "prenatals" }], rowCount: 1 };
      if (String(sql).includes("prenatal_completed_at")) {
        return { rows: [{ prenatal_completed_at: new Date().toISOString() }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });
    expect((await completeProp("mom", "preg", "prenatals", useId, false, 280)).ok).toBe(true);
    expect(mocks.query.mock.calls.some(([sql]) => String(sql).includes("update user_stats"))).toBe(
      false,
    );
  });
  it("closes an open hydration moment when the sip is saved", async () => {
    mocks.query.mockImplementation(async (sql: string) => {
      if (String(sql).includes("from event_history")) {
        return { rows: [{ id: "event-1", choices: [{ key: "water" }] }], rowCount: 1 };
      }
      if (String(sql).includes("update event_history")) return { rows: [], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    });
    const result = await completeProp("mom", "preg", "water", useId, false);
    expect(result.ok).toBe(true);
    expect(result.message).toContain("moment");
    expect(mocks.query.mock.calls.some(([sql]) => String(sql).includes("update event_history"))).toBe(
      true,
    );
  });
});

describe("care cooldown on delivery", () => {
  it("does not give another prenatal bottle during the dose window", async () => {
    mocks.query.mockResolvedValue({
      rows: [{ prenatal_completed_at: new Date().toISOString(), water_completed_at: null }],
      rowCount: 1,
    });
    const result = await requestProp("mom", "prenatals", false, 280);
    expect(result.ok).toBe(false);
    expect(mocks.queue).not.toHaveBeenCalled();
    expect(mocks.connect).not.toHaveBeenCalled();
  });
});
