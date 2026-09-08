// Conception rules.
//
// Pure decision logic, deliberately kept out of game.ts. Everything here is a
// plain function over values — no database, no clock, no Math.random unless
// one is handed in — so the odds, the cooldown and the test window can be
// tested directly instead of only through a live pregnancy.
//
// game.ts owns the side effects: it reads the row, calls these, and writes the
// result. The split matters because these three rules are the ones a player
// will actually notice being wrong, and they were previously only reachable
// through a database-backed integration suite that does not run by default.
//
// Shared with the HUD so the fertility buttons and the server can never drift.

export const FERTILITY_LEVELS = ["low", "normal", "high"] as const;

export type Fertility = (typeof FERTILITY_LEVELS)[number];

/** Odds of a single attempt landing. */
export const FERTILITY_CHANCE: Record<Fertility, number> = {
  low: 0.22,
  normal: 0.45,
  high: 0.72,
};

export const FERTILITY_COPY: Record<Fertility, { label: string; hint: string }> = {
  low: { label: "Low", hint: "It may take a while. A slower, longer story." },
  normal: { label: "Normal", hint: "A realistic chance each time you try." },
  high: { label: "High", hint: "It usually happens quickly." },
};

/** How long after conception a test can read positive. */
export const TEST_WAIT_MINUTES = 5;

/** How long between attempts, so the button is a moment and not a slot machine. */
export const ATTEMPT_COOLDOWN_MINUTES = 2;

const MINUTE = 60_000;

/** Anything unrecognised becomes "normal" rather than throwing or scoring 0. */
export function normalizeFertility(value: unknown): Fertility {
  return FERTILITY_LEVELS.includes(value as Fertility) ? (value as Fertility) : "normal";
}

export function chanceFor(value: unknown): number {
  return FERTILITY_CHANCE[normalizeFertility(value)];
}

// ---------------------------------------------------------------------------

export interface CooldownState {
  /** Still waiting? */
  blocked: boolean;
  /** Whole minutes to show her, never 0 while blocked. */
  minutesLeft: number;
  msLeft: number;
}

/**
 * How long until she may try again. A missing or unparseable last attempt is
 * treated as "never tried", which is the permissive answer on purpose: a null
 * here must not lock the button.
 */
export function attemptCooldown(
  lastAttemptAt: string | Date | null | undefined,
  now: number,
): CooldownState {
  if (!lastAttemptAt) return { blocked: false, minutesLeft: 0, msLeft: 0 };
  const last =
    lastAttemptAt instanceof Date ? lastAttemptAt.getTime() : Date.parse(String(lastAttemptAt));
  if (!Number.isFinite(last)) return { blocked: false, minutesLeft: 0, msLeft: 0 };

  const msLeft = last + ATTEMPT_COOLDOWN_MINUTES * MINUTE - now;
  if (msLeft <= 0) return { blocked: false, minutesLeft: 0, msLeft: 0 };
  return { blocked: true, minutesLeft: Math.max(1, Math.ceil(msLeft / MINUTE)), msLeft };
}

// ---------------------------------------------------------------------------

export interface AttemptInput {
  fertility: unknown;
  /** Set once an earlier attempt already landed. */
  conceivedOn: string | Date | null | undefined;
  rng?: () => number;
}

export interface AttemptOutcome {
  /** True when she is pregnant after this attempt, whether or not it was this one. */
  conceived: boolean;
  /** True when an earlier attempt had already landed, so nothing was re-rolled. */
  alreadyConceived: boolean;
  /** Odds used. Logged so the numbers can be tuned against real play. */
  chance: number;
  /** Should the caller write conceived_on / test_ready_at? */
  writesConception: boolean;
}

/**
 * Roll one attempt.
 *
 * If she already conceived and simply has not tested yet, the roll is skipped
 * entirely — re-rolling would let a second attempt "un-conceive" her, and
 * rewriting the test window would silently push her reveal further away.
 */
export function rollAttempt({
  fertility,
  conceivedOn,
  rng = Math.random,
}: AttemptInput): AttemptOutcome {
  const chance = chanceFor(fertility);
  const alreadyConceived = Boolean(conceivedOn);
  if (alreadyConceived) {
    return { conceived: true, alreadyConceived: true, chance, writesConception: false };
  }
  const conceived = rng() < chance;
  return { conceived, alreadyConceived: false, chance, writesConception: conceived };
}

// ---------------------------------------------------------------------------

export interface TestInput {
  conceivedOn: string | Date | null | undefined;
  testReadyAt: string | Date | null | undefined;
  now: number;
}

export interface TestOutcome {
  positive: boolean;
  /** She has conceived, but the test cannot show it yet. */
  tooEarly: boolean;
}

/**
 * Read a pregnancy test.
 *
 * `tooEarly` is only ever true when she really has conceived — an honest "it
 * may be too early" on a negative that is simply negative would be a lie that
 * keeps her testing forever.
 *
 * A conception with no test window is treated as ready. That combination
 * should not occur, but defaulting to "not ready" would strand her on a test
 * that never turns positive, which is far worse than revealing it a little early.
 */
export function readTest({ conceivedOn, testReadyAt, now }: TestInput): TestOutcome {
  if (!conceivedOn) return { positive: false, tooEarly: false };

  const ready =
    testReadyAt instanceof Date ? testReadyAt.getTime() : Date.parse(String(testReadyAt ?? ""));
  if (!Number.isFinite(ready)) return { positive: true, tooEarly: false };

  if (now < ready) return { positive: false, tooEarly: true };
  return { positive: true, tooEarly: false };
}

/** When a test taken now would first read positive. */
export function testReadyFrom(conceivedAt: number): number {
  return conceivedAt + TEST_WAIT_MINUTES * MINUTE;
}
