// Pure pregnancy math + fetal growth reference. Safe to import on client & server.

export interface BabyMilestone {
  week: number;
  size: string;
  lengthCm: number;
  weightG: number;
  note: string;
}

// Fetal growth reference (approximate, week → size comparison)
export const BABY_GROWTH: BabyMilestone[] = [
  { week: 4, size: "Poppy seed", lengthCm: 0.2, weightG: 0.5, note: "The journey begins — a tiny spark of life." },
  { week: 6, size: "Sweet pea", lengthCm: 0.6, weightG: 1, note: "A little heart begins to flutter." },
  { week: 8, size: "Raspberry", lengthCm: 1.6, weightG: 2, note: "Tiny fingers and toes are forming." },
  { week: 10, size: "Strawberry", lengthCm: 3.1, weightG: 4, note: "All vital organs are in place." },
  { week: 12, size: "Lime", lengthCm: 5.4, weightG: 14, note: "Reflexes are developing — hello little wiggles." },
  { week: 14, size: "Lemon", lengthCm: 8.7, weightG: 43, note: "Baby can squint and frown now." },
  { week: 16, size: "Avocado", lengthCm: 11.6, weightG: 100, note: "You may feel the first flutters soon." },
  { week: 18, size: "Bell pepper", lengthCm: 14.2, weightG: 190, note: "Little ears can hear your voice." },
  { week: 20, size: "Banana", lengthCm: 25.6, weightG: 300, note: "Halfway there! Baby is getting stronger." },
  { week: 22, size: "Papaya", lengthCm: 27.8, weightG: 430, note: "Baby responds to sound and touch." },
  { week: 24, size: "Cantaloupe", lengthCm: 30.1, weightG: 650, note: "Kicks are getting easier to feel." },
  { week: 26, size: "Lettuce head", lengthCm: 35.6, weightG: 760, note: "Little eyes are starting to open." },
  { week: 28, size: "Eggplant", lengthCm: 37.6, weightG: 1000, note: "Third trimester — baby can dream now." },
  { week: 30, size: "Cabbage", lengthCm: 39.9, weightG: 1300, note: "Baby practices breathing movements." },
  { week: 32, size: "Squash", lengthCm: 42.4, weightG: 1700, note: "Getting chubby and cozy in there." },
  { week: 34, size: "Pineapple", lengthCm: 45, weightG: 2100, note: "Baby is likely settling head-down." },
  { week: 36, size: "Honeydew melon", lengthCm: 47.4, weightG: 2600, note: "Almost ready to meet you." },
  { week: 38, size: "Winter melon", lengthCm: 49.8, weightG: 3000, note: "Full term — any day now!" },
  { week: 40, size: "Little pumpkin", lengthCm: 51.2, weightG: 3400, note: "Welcome to the world, little one ♥" },
];

export function milestoneForWeek(week: number): BabyMilestone {
  let best = BABY_GROWTH[0];
  for (const m of BABY_GROWTH) if (m.week <= week) best = m;
  return best;
}

export interface PregnancyProgress {
  week: number;
  day: number;
  trimester: 1 | 2 | 3;
  progressPct: number;
  daysToGo: number;
  dueDate: Date;
  delivered: boolean;
}

/**
 * Maps real elapsed time onto a 40-week pregnancy.
 * durationDays is the real-life length of the full pregnancy (SL pregnancies
 * usually run a few weeks; 280 = realtime).
 */
export function computeProgress(conceivedAt: Date, durationDays: number, now = new Date()): PregnancyProgress {
  const totalMs = durationDays * 86_400_000;
  const elapsedMs = Math.max(0, now.getTime() - conceivedAt.getTime());
  const frac = Math.min(1, elapsedMs / totalMs);
  const totalDays40 = 280 * frac;
  const week = Math.min(40, Math.floor(totalDays40 / 7));
  const day = Math.floor(totalDays40 % 7);
  const trimester: 1 | 2 | 3 = week < 13 ? 1 : week < 28 ? 2 : 3;
  const dueDate = new Date(conceivedAt.getTime() + totalMs);
  const daysToGo = Math.max(0, Math.ceil((dueDate.getTime() - now.getTime()) / 86_400_000));
  return {
    week,
    day,
    trimester,
    progressPct: Math.round(frac * 100),
    daysToGo,
    dueDate,
    delivered: frac >= 1,
  };
}

export function heartbeatForWeek(week: number): number {
  if (week < 6) return 0;
  if (week < 9) return 165;
  if (week < 14) return 155;
  if (week < 28) return 145;
  return 140;
}

export const DEFAULT_SYMPTOMS = ["Nausea", "Fatigue", "Back Pain", "Headache", "Heartburn"] as const;

export function severityLabel(severity: number): string {
  if (severity <= 5) return "None";
  if (severity <= 35) return "Mild";
  if (severity <= 65) return "Moderate";
  return "Severe";
}
