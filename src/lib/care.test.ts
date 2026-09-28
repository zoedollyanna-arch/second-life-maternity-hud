import { describe, expect, it } from "vitest";
import {
  PRENATAL_MIN_MS,
  WATER_COOLDOWN_MS,
  doseReady,
  prenatalIntervalMs,
  prenatalMissDue,
  simulatedDayMs,
} from "./care";

describe("prenatal interval", () => {
  it("uses one simulated day when that day is longer than six hours", () => {
    expect(prenatalIntervalMs(280)).toBe(simulatedDayMs(280));
    expect(prenatalIntervalMs(280)).toBe(86_400_000);
  });

  it("never lets a short pregnancy farm a dose every few minutes", () => {
    expect(simulatedDayMs(1)).toBeLessThan(10 * 60_000);
    expect(prenatalIntervalMs(1)).toBe(PRENATAL_MIN_MS);
    expect(prenatalIntervalMs(28)).toBe(PRENATAL_MIN_MS);
  });
});

describe("dose cooldown", () => {
  it("is ready until the first completion", () => {
    expect(doseReady(null, WATER_COOLDOWN_MS, 1_000).ready).toBe(true);
  });

  it("blocks water until two hours have passed", () => {
    const completed = 1_000_000;
    const during = doseReady(completed, WATER_COOLDOWN_MS, completed + 60_000);
    const after = doseReady(completed, WATER_COOLDOWN_MS, completed + WATER_COOLDOWN_MS);
    expect(during.ready).toBe(false);
    expect(after.ready).toBe(true);
  });
});

describe("missed prenatal", () => {
  const conceived = 0;
  const interval = prenatalIntervalMs(280);

  it("does not punish a dose that is still inside its window", () => {
    expect(
      prenatalMissDue({
        now: interval - 1,
        conceivedAt: conceived,
        completedAt: null,
        missMarkedAt: null,
        durationDays: 280,
      }),
    ).toBe(false);
  });

  it("marks one miss when the window passes, then waits for the next window", () => {
    expect(
      prenatalMissDue({
        now: interval + 1,
        conceivedAt: conceived,
        completedAt: null,
        missMarkedAt: null,
        durationDays: 280,
      }),
    ).toBe(true);
    expect(
      prenatalMissDue({
        now: interval + 1,
        conceivedAt: conceived,
        completedAt: null,
        missMarkedAt: interval + 1,
        durationDays: 280,
      }),
    ).toBe(false);
  });

  it("restarts the window from the last completed dose", () => {
    const completed = interval;
    expect(
      prenatalMissDue({
        now: completed + interval - 1,
        conceivedAt: conceived,
        completedAt: completed,
        missMarkedAt: null,
        durationDays: 280,
      }),
    ).toBe(false);
  });
});
