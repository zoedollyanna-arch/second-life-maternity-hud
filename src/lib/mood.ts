// Random pregnancy mood swings with cute RP text.
// Meters nudge which swing is more likely. They never lock a mood.

export const MOOD_KEYS = [
  "happy",
  "excited",
  "calm",
  "emotional",
  "sad",
  "crying",
  "frustrated",
  "irritated",
  "anxious",
  "lonely",
  "sleepy",
  "tired",
  "exhausted",
  "stressed",
  "overwhelmed",
] as const;

export type MoodKey = (typeof MOOD_KEYS)[number];

export interface MoodInfo {
  key: MoodKey;
  label: string;
  emoji: string;
  note: string;
}

export const MOOD_CATALOG: Record<MoodKey, Omit<MoodInfo, "key">> = {
  happy: { label: "Happy", emoji: "😊", note: "A warm little glow." },
  excited: { label: "Excited", emoji: "✨", note: "The baby feels close and real." },
  calm: { label: "Calm", emoji: "🤍", note: "Soft and settled, just for a minute." },
  emotional: { label: "Emotional", emoji: "🥹", note: "Everything is a little closer to the surface." },
  sad: { label: "Sad", emoji: "😔", note: "A quiet heavy-heart moment." },
  crying: { label: "Crying", emoji: "😢", note: "Tears, for a reason or for none." },
  frustrated: { label: "Frustrated", emoji: "😤", note: "The smallest thing feels like too much." },
  irritated: { label: "Irritated", emoji: "😒", note: "Skin-thin and over it." },
  anxious: { label: "Anxious", emoji: "😟", note: "Mind running ahead of the body." },
  lonely: { label: "Lonely", emoji: "🌙", note: "Wishing someone would check in." },
  sleepy: { label: "Sleepy", emoji: "🥱", note: "A yawn that won't wait." },
  tired: { label: "Tired", emoji: "😮‍💨", note: "Worn in a way sleep might not fix yet." },
  exhausted: { label: "Exhausted", emoji: "😩", note: "Bone-deep tired." },
  stressed: { label: "Stressed", emoji: "😫", note: "Holding too many things at once." },
  overwhelmed: { label: "Overwhelmed", emoji: "🌊", note: "Too much, too fast." },
};

const RP_LINES: Record<MoodKey, string[]> = {
  happy: [
    "She catches herself smiling at nothing. The baby, the light, a silly thought — all of it feels sweet.",
    "A happy little flutter, inside and out. She presses a hand to her belly and laughs under her breath.",
    "For a moment everything is soft and right. She wants to stay in it.",
  ],
  excited: [
    "She can't sit still. The baby, the future, the name list — it all feels close enough to touch.",
    "A spark of excitement runs through her. She almost texts everyone. Almost.",
    "She grins at her own reflection. Pregnant and glowing, even if her hair is a mess.",
  ],
  calm: [
    "The world goes quiet for a minute. Hand on bump, breath slow. Just this.",
    "A rare, perfect calm. No lists. No worries. Just her and the little one.",
    "She feels held, even if no one is in the room.",
  ],
  emotional: [
    "A commercial, a song, the way someone said her name — and her eyes are wet. Hormones, she whispers. Hormones.",
    "She feels everything at once. Love, worry, wonder. It doesn't need a reason.",
    "One kind word and she might cry. One sharp one, too. Her heart is wide open today.",
  ],
  sad: [
    "A quiet sadness sits down beside her. She doesn't need it fixed. She just needs it witnessed.",
    "She misses who she was last year, and loves who she's becoming, and both things are true.",
    "The baby kicks, gentle. She still feels a little blue. That's allowed.",
  ],
  crying: [
    "Tears, sudden and sloppy. She doesn't even know why — and then she laughs through them, because of course she doesn't.",
    "She's crying over a spoon. Or a memory. Or nothing. All of it counts.",
    "The tears come easy today. She lets them. The baby doesn't mind.",
  ],
  frustrated: [
    "The zipper. The jar. The sentence she can't finish. She could scream — or sit down and breathe. Maybe both.",
    "Everything is slightly too hard and she is slightly too done.",
    "She mutters at the furniture. The furniture deserves it, honestly.",
  ],
  irritated: [
    "The tag in her shirt is a personal attack. So is that sound. So is existing, a little.",
    "Don't ask if she's hungry. Don't ask if she's tired. She already knows.",
    "Irritated at the air. It will pass. It always does. Not yet though.",
  ],
  anxious: [
    "Her mind runs a little ahead — what if, what if, what if. She puts a hand on her belly to come back.",
    "A flutter of worry with no name. She wants a squeeze of the hand more than answers.",
    "Anxious energy, nowhere to put it. Walk? Water? Someone saying you're okay?",
  ],
  lonely: [
    "The room is too quiet. She wants a voice, a text, a knock. Just to know someone is thinking of them.",
    "Lonely in that pregnancy way — surrounded by a whole tiny person and still wishing for company.",
    "She almost IMs. She hopes someone IMs first.",
  ],
  sleepy: [
    "A yawn steals the sentence. Her eyes go soft. Five minutes. Or fifty.",
    "Sleepy hits like a blanket. The couch is calling her name.",
    "She could fall asleep sitting up. The baby is already practicing.",
  ],
  tired: [
    "Tired in the bones, not just the eyes. She did nothing and everything today.",
    "Growing a person is a full-time job she can't clock out of. She's allowed to be tired.",
    "She leans on the nearest thing. Upright is optional.",
  ],
  exhausted: [
    "Exhausted. Not dramatic — just true. She needs a nest, a dim room, and no plans.",
    "If someone offered to carry her three steps, she might say yes.",
    "The kind of tired that makes the world fuzzy and sweet and far away.",
  ],
  stressed: [
    "Too many tabs open in her head. She wants one thing to be simple.",
    "Stressed, then guilty for being stressed, then stressed about the guilt. Classic.",
    "A hand on her back would help more than a list right now.",
  ],
  overwhelmed: [
    "It's all a lot. The body, the future, the laundry. She needs the world to be quieter.",
    "Overwhelmed in a wave. It will recede. She just has to ride this one.",
    "She might cry, laugh, or take a nap. Any of those is a good answer.",
  ],
};

export interface MoodStats {
  hunger: number;
  hydration: number;
  energy: number;
  rest: number;
  mood: number;
  stress: number;
  sickness: number;
  bladder: number;
  comfort: number;
  nutrition?: number;
  vitamins?: number;
  partnerLinked?: boolean;
  partnerSupport?: number;
}

export interface MoodEvent {
  key: MoodKey;
  label: string;
  emoji: string;
  title: string;
  body: string;
  notifyPartner: boolean;
}

function deficit(stat: number, threshold: number) {
  return Math.max(0, threshold - stat);
}

function excess(stat: number, threshold: number) {
  return Math.max(0, stat - threshold);
}

function pickWeighted(weights: Record<MoodKey, number>): MoodKey {
  let total = 0;
  for (const key of MOOD_KEYS) total += Math.max(0.15, weights[key]);
  let roll = Math.random() * total;
  for (const key of MOOD_KEYS) {
    roll -= Math.max(0.15, weights[key]);
    if (roll <= 0) return key;
  }
  return "calm";
}

export function rpLineFor(key: MoodKey): string {
  const lines = RP_LINES[key];
  return lines[Math.floor(Math.random() * lines.length)];
}

/** Every mood can still land. Meters and trimester only tilt the odds. */
export function pickMoodEvent(trimester: 1 | 2 | 3, stats: MoodStats): MoodEvent {
  const weights = Object.fromEntries(MOOD_KEYS.map((key) => [key, 1])) as Record<MoodKey, number>;
  const bump = (key: MoodKey, n: number) => {
    weights[key] += Math.max(0, n);
  };

  if (trimester === 1) {
    bump("emotional", 3);
    bump("crying", 2.5);
    bump("sleepy", 2);
    bump("anxious", 2);
    bump("irritated", 1.5);
  } else if (trimester === 2) {
    bump("happy", 3);
    bump("excited", 3);
    bump("calm", 2);
    bump("emotional", 1.5);
  } else {
    bump("tired", 3);
    bump("exhausted", 2.5);
    bump("overwhelmed", 2);
    bump("anxious", 2);
    bump("sleepy", 2);
    bump("excited", 1.5);
  }

  bump("irritated", deficit(stats.hunger, 42) / 5);
  bump("frustrated", deficit(stats.hunger, 32) / 6);
  bump("irritated", deficit(stats.bladder, 32) / 5);
  bump("anxious", deficit(stats.hydration, 42) / 5);
  bump("tired", deficit(stats.hydration, 35) / 10);

  bump("exhausted", (deficit(stats.energy, 28) + deficit(stats.rest, 28)) / 5);
  bump("tired", (deficit(stats.energy, 48) + deficit(stats.rest, 42)) / 7);
  bump("sleepy", (deficit(stats.energy, 58) + deficit(stats.rest, 52)) / 9);

  bump("overwhelmed", excess(stats.sickness, 40) / 7);
  bump("emotional", excess(stats.sickness, 32) / 10);
  bump("crying", excess(stats.sickness, 50) / 9);

  bump("stressed", excess(stats.stress, 40) / 5);
  bump("overwhelmed", excess(stats.stress, 55) / 7);
  bump("anxious", excess(stats.stress, 45) / 8);

  bump("frustrated", deficit(stats.comfort, 42) / 7);
  bump("irritated", deficit(stats.comfort, 32) / 9);

  bump("sad", deficit(stats.mood, 42) / 5);
  bump("crying", deficit(stats.mood, 30) / 5);
  bump("happy", excess(stats.mood, 68) / 7);
  bump("calm", excess(stats.mood, 60) / 9 + excess(stats.comfort, 55) / 12);

  if (typeof stats.nutrition === "number") {
    bump("tired", deficit(stats.nutrition, 40) / 10);
    bump("irritated", deficit(stats.nutrition, 30) / 12);
  }
  if (typeof stats.vitamins === "number") {
    bump("anxious", deficit(stats.vitamins, 35) / 12);
    bump("tired", deficit(stats.vitamins, 30) / 14);
  }

  if (!stats.partnerLinked) {
    bump("lonely", 4);
    bump("sad", 1.5);
  } else {
    const support = stats.partnerSupport ?? 40;
    bump("lonely", deficit(support, 42) / 5);
    bump("sad", deficit(support, 28) / 10);
    bump("happy", excess(support, 55) / 9);
    bump("calm", excess(support, 62) / 10);
  }

  const key = pickWeighted(weights);
  const info = MOOD_CATALOG[key];
  return {
    key,
    label: info.label,
    emoji: info.emoji,
    title: `${info.emoji} ${info.label}`,
    body: rpLineFor(key),
    notifyPartner: true,
  };
}

export function moodFromKey(key: string | null | undefined): MoodInfo {
  const safe = MOOD_KEYS.includes(key as MoodKey) ? (key as MoodKey) : "calm";
  return { key: safe, ...MOOD_CATALOG[safe] };
}
