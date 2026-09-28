import type { StatName } from "./foods";

/** One simulated pregnancy day, in real milliseconds, for a configured term. */
export function simulatedDayMs(durationDays: number): number {
  const days = Math.min(280, Math.max(1, Number(durationDays) || 28));
  return (days / 280) * 86_400_000;
}

/**
 * Prenatals are once per simulated day. A very short term would make that
 * only a few real minutes, which is long enough to farm the dose, so the
 * interval never drops below six real hours.
 */
export const PRENATAL_MIN_MS = 6 * 60 * 60 * 1000;

/** Hydration is a real-time meter. Two hours blocks click-farming without making water rare. */
export const WATER_COOLDOWN_MS = 2 * 60 * 60 * 1000;

export function prenatalIntervalMs(durationDays: number): number {
  return Math.max(simulatedDayMs(durationDays), PRENATAL_MIN_MS);
}

/**
 * One missed window, not a stack for every hour she was offline.
 * Natural vitamin decay already ran for that time.
 */
export const PRENATAL_MISS_DELTAS: Partial<Record<StatName, number>> = {
  vitamins: -8,
  immunity: -4,
  nutrition: -2,
  baby_wellness: -1,
};

export function doseReady(completedAt: number | null, intervalMs: number, now: number) {
  if (completedAt == null || !Number.isFinite(completedAt)) {
    return { ready: true, nextAt: null as string | null };
  }
  const next = completedAt + intervalMs;
  if (now >= next) return { ready: true, nextAt: null as string | null };
  return { ready: false, nextAt: new Date(next).toISOString() };
}

export function prenatalMissDue(opts: {
  now: number;
  conceivedAt: number;
  completedAt: number | null;
  missMarkedAt: number | null;
  durationDays: number;
}): boolean {
  if (!Number.isFinite(opts.conceivedAt)) return false;
  const interval = prenatalIntervalMs(opts.durationDays);
  const anchor = opts.completedAt ?? opts.conceivedAt;
  if (opts.now < anchor + interval) return false;
  if (opts.missMarkedAt != null && opts.now < opts.missMarkedAt + interval) return false;
  return true;
}

export function formatWait(ms: number): string {
  const minutes = Math.max(1, Math.ceil(ms / 60_000));
  const hours = Math.floor(minutes / 60);
  const remain = minutes % 60;
  if (hours <= 0) return `${minutes}m`;
  if (remain === 0) return `${hours}h`;
  return `${hours}h ${remain}m`;
}

export function cooldownMessage(propKey: string, nextAt: string | null, now = Date.now()): string {
  const left = nextAt ? formatWait(new Date(nextAt).getTime() - now) : "a little while";
  if (propKey === "prenatals") {
    return `You already took your prenatal, sweet one. Next dose in ${left}.`;
  }
  if (propKey === "water") {
    return `You just had your lemon water. Another glass in ${left}.`;
  }
  return `That treat needs a little rest. Try again in ${left}.`;
}
