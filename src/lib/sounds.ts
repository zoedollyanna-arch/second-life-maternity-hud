// Synthesized UI sounds for the MOAP dashboard.
//
// Everything is generated with the Web Audio API — no sound files to upload.
// Because the dashboard runs on the HUD's media face, whatever it plays is
// heard in Second Life through media audio, so the in-world sound clips in
// the LSL scripts are purely optional extras.

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(
  ac: AudioContext,
  opts: { freq: number; at: number; dur: number; type?: OscillatorType; gain?: number; glideTo?: number },
) {
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = opts.type ?? "sine";
  const t0 = ac.currentTime + opts.at;
  osc.frequency.setValueAtTime(opts.freq, t0);
  if (opts.glideTo) osc.frequency.exponentialRampToValueAtTime(opts.glideTo, t0 + opts.dur);
  const peak = opts.gain ?? 0.12;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
  osc.connect(g).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + opts.dur + 0.05);
}

function noise(
  ac: AudioContext,
  opts: { at: number; dur: number; filterFreq: number; filterQ?: number; gain?: number; sweepTo?: number },
) {
  const t0 = ac.currentTime + opts.at;
  const frames = Math.ceil(ac.sampleRate * opts.dur);
  const buffer = ac.createBuffer(1, frames, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(opts.filterFreq, t0);
  if (opts.sweepTo) filter.frequency.exponentialRampToValueAtTime(opts.sweepTo, t0 + opts.dur);
  filter.Q.value = opts.filterQ ?? 1.2;
  const g = ac.createGain();
  const peak = opts.gain ?? 0.1;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
  src.connect(filter).connect(g).connect(ac.destination);
  src.start(t0);
  src.stop(t0 + opts.dur + 0.05);
}

/** Soft two-note bell — confirmations, notifications. */
export function playChime() {
  const ac = audio();
  if (!ac) return;
  tone(ac, { freq: 880, at: 0, dur: 0.35, gain: 0.09 });
  tone(ac, { freq: 1174.66, at: 0.12, dur: 0.5, gain: 0.08 });
}

/** Sparkly rising arpeggio — hugs, hearts, milestones. */
export function playHearts() {
  const ac = audio();
  if (!ac) return;
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((f, i) => tone(ac, { freq: f, at: i * 0.09, dur: 0.4, gain: 0.07 }));
}

/** Water sip / pouring — hydration actions. */
export function playWater() {
  const ac = audio();
  if (!ac) return;
  noise(ac, { at: 0, dur: 0.35, filterFreq: 1200, sweepTo: 500, filterQ: 2, gain: 0.12 });
  noise(ac, { at: 0.28, dur: 0.22, filterFreq: 900, sweepTo: 1600, filterQ: 3, gain: 0.07 });
}

/** Fetal doppler heartbeat — ~145 bpm, four lub-dubs. */
export function playHeartbeat() {
  const ac = audio();
  if (!ac) return;
  const beat = 60 / 145;
  for (let i = 0; i < 4; i++) {
    const t = i * beat;
    tone(ac, { freq: 95, at: t, dur: 0.11, type: "sine", gain: 0.22, glideTo: 55 });
    tone(ac, { freq: 80, at: t + 0.14, dur: 0.09, type: "sine", gain: 0.16, glideTo: 50 });
  }
}

/** Single soft thump — baby kicks. */
export function playKick() {
  const ac = audio();
  if (!ac) return;
  tone(ac, { freq: 140, at: 0, dur: 0.16, type: "sine", gain: 0.2, glideTo: 60 });
}

/** Crunchy munch — eating & snacks. */
export function playMunch() {
  const ac = audio();
  if (!ac) return;
  noise(ac, { at: 0, dur: 0.09, filterFreq: 2200, filterQ: 0.8, gain: 0.1 });
  noise(ac, { at: 0.16, dur: 0.09, filterFreq: 1800, filterQ: 0.8, gain: 0.09 });
  noise(ac, { at: 0.32, dur: 0.1, filterFreq: 1500, filterQ: 0.8, gain: 0.08 });
}

/** Little pill-bottle pop + chime — vitamins. */
export function playPop() {
  const ac = audio();
  if (!ac) return;
  tone(ac, { freq: 420, at: 0, dur: 0.07, type: "square", gain: 0.06, glideTo: 900 });
  tone(ac, { freq: 987.77, at: 0.1, dur: 0.3, gain: 0.07 });
}

/** Dreamy descending pad — rest, comfort, bath. */
export function playRelax() {
  const ac = audio();
  if (!ac) return;
  tone(ac, { freq: 659.25, at: 0, dur: 0.6, gain: 0.05 });
  tone(ac, { freq: 523.25, at: 0.2, dur: 0.7, gain: 0.05 });
  tone(ac, { freq: 392, at: 0.4, dur: 0.9, gain: 0.05 });
}

/** Gentle low buzz — errors / can't do that. */
export function playError() {
  const ac = audio();
  if (!ac) return;
  tone(ac, { freq: 220, at: 0, dur: 0.18, type: "triangle", gain: 0.07 });
  tone(ac, { freq: 196, at: 0.2, dur: 0.25, type: "triangle", gain: 0.07 });
}

/** Map a HUD action to its sound. */
export function playForAction(action: string) {
  switch (action) {
    case "drink_water":
    case "partner_water":
    case "warm_bath":
      return playWater();
    case "heartbeat":
    case "doctor":
    case "ultrasound":
      return playHeartbeat();
    case "kick":
    case "talk_to_baby":
      return playKick();
    case "eat":
    case "food_eat":
    case "snack":
    case "craving_choice":
      return playMunch();
    case "vitamins":
      return playPop();
    case "rest":
    case "comfort":
    case "comfort_complete":
    case "breathe":
      return playRelax();
    case "hug":
    case "hold_belly":
    case "support":
    case "memory":
      return playHearts();
    default:
      return playChime();
  }
}
