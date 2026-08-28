/**
 * Every sound in the game is synthesised on the spot with Web Audio - there
 * are no audio files to download, nothing to 404, and the whole thing costs a
 * couple of kilobytes. A phone game that has to fetch a sprite sheet of sounds
 * before the first round feels broken on a bad connection.
 *
 * An AudioContext cannot start before a user gesture, so this stays unbuilt
 * until the first play() call and silently does nothing if it is refused.
 *
 * ---- why these sounds are shaped the way they are ------------------------
 *
 * The first pass sounded, in the words of the person who has to listen to it,
 * like farting. That was not a matter of taste; it was three concrete faults:
 *
 *   1. Low sawtooths. A sawtooth at 60-150Hz IS a raspberry - all the odd and
 *      even harmonics, buzzing right in the range the ear hears as a body
 *      noise. The stamp (150->60), the dash (180->520) and the flame (90->320)
 *      were all built on one.
 *   2. Downward pitch glides on those saws. A falling buzz is the exact
 *      contour of the thing being complained about.
 *   3. No headroom. Seven cars' worth of gust, a flare and a stamp could all
 *      land in the same 200ms at a master gain of 0.9, and the sum clipped.
 *      Clipping folds a clean tone into a buzzy one, so even the good sounds
 *      turned rude when they stacked.
 *
 * So: percussion is a SINE with a fast pitch drop (that is how a kick drum is
 * made, and a sine has no harmonics to buzz with), air is NOISE rather than a
 * tone, anything tonal sits above 300Hz, and everything goes through a
 * limiter so a pile-up ducks instead of distorting.
 */
export type Sfx =
  | "click"      // a choice is committed
  | "tick"       // the last three seconds
  | "stamp"      // the majority is revealed
  | "dash"       // the winners pull away
  | "flame"      // a booster fires
  | "slump"      // the minority stays put
  | "alert"      // a special round is announced
  | "finish";    // someone crosses the line

const MUTE_KEY = "ddr.muted";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = readMuted();

function readMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function isMuted() {
  return muted;
}

export function setMuted(next: boolean) {
  muted = next;
  try {
    localStorage.setItem(MUTE_KEY, next ? "1" : "0");
  } catch {
    // a private window just means the choice does not survive a reload
  }
  if (master && ctx) master.gain.setTargetAtTime(next ? 0 : 0.62, ctx.currentTime, 0.02);
}

function audio() {
  if (ctx) return ctx;
  try {
    const Ctor = window.AudioContext ?? (window as unknown as {
      webkitAudioContext: typeof AudioContext;
    }).webkitAudioContext;
    ctx = new Ctor();

    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.62;

    // The limiter is the whole reason overlapping effects stay clean. Without
    // it the sum of a stamp, a flare and seven gusts runs past 1.0 and the
    // hardware clips it - and a clipped sine is a buzz.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -14;
    limiter.knee.value = 6;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.18;

    master.connect(limiter).connect(ctx.destination);
  } catch {
    ctx = null;
  }
  return ctx;
}

/**
 * One tone. Attack is linear (an exponential ramp from near-zero clicks), the
 * tail is exponential (that is what decay actually sounds like).
 */
function tone(o: {
  freq: number;
  to?: number;
  dur: number;
  gain: number;
  type?: OscillatorType;
  at?: number;
  /** seconds of attack; a longer one takes the edge off */
  attack?: number;
  detune?: number;
}) {
  const c = audio();
  if (!c || !master) return;
  const t0 = c.currentTime + (o.at ?? 0);
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = o.type ?? "sine";
  if (o.detune) osc.detune.value = o.detune;
  osc.frequency.setValueAtTime(o.freq, t0);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t0 + o.dur);

  const a = o.attack ?? 0.006;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(o.gain, t0 + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);

  osc.connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + o.dur + 0.03);
}

/**
 * A drum. Sine with a fast pitch drop: no harmonics, so however low it goes it
 * thumps instead of buzzing. This replaces every low sawtooth in the old set.
 */
function thump(o: { from: number; to: number; dur: number; gain: number; at?: number }) {
  const c = audio();
  if (!c || !master) return;
  const t0 = c.currentTime + (o.at ?? 0);
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(o.from, t0);
  // the pitch has to fall much faster than the amplitude, or it reads as a
  // slide whistle rather than an impact
  osc.frequency.exponentialRampToValueAtTime(o.to, t0 + Math.min(o.dur, 0.08));
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(o.gain, t0 + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
  osc.connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + o.dur + 0.03);
}

/** filtered white noise - wind, dust, the hiss of a flare, the crack of a hit */
function noise(o: {
  dur: number;
  gain: number;
  from: number;
  to?: number;
  type?: BiquadFilterType;
  q?: number;
  at?: number;
  /** 0..1 of the duration spent rising; small is a crack, large is a whoosh */
  attack?: number;
}) {
  const c = audio();
  if (!c || !master) return;
  const t0 = c.currentTime + (o.at ?? 0);
  const frames = Math.max(1, Math.floor(c.sampleRate * o.dur));
  const buf = c.createBuffer(1, frames, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;

  const src = c.createBufferSource();
  src.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = o.type ?? "bandpass";
  filter.frequency.setValueAtTime(o.from, t0);
  if (o.to) filter.frequency.exponentialRampToValueAtTime(o.to, t0 + o.dur);
  filter.Q.value = o.q ?? 0.7;

  const g = c.createGain();
  const rise = o.dur * (o.attack ?? 0.12);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(o.gain, t0 + rise);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);

  src.connect(filter).connect(g).connect(master);
  src.start(t0);
}

export function play(sfx: Sfx) {
  if (muted) return;
  switch (sfx) {
    // A UI blip, not a note: two quick triangles a fifth apart, both well
    // clear of the range that buzzes.
    case "click":
      tone({ freq: 880, dur: 0.05, gain: 0.16, type: "triangle" });
      tone({ freq: 1320, dur: 0.07, gain: 0.1, type: "triangle", at: 0.03 });
      break;

    // The clock has to be heard under everything else without ever being the
    // loudest thing, so it is short, high and quiet.
    case "tick":
      tone({ freq: 1760, dur: 0.035, gain: 0.07, type: "sine" });
      break;

    // The reveal: a rim crack on top of a kick. The crack carries the
    // "stamped" feeling; the kick carries the weight the old sawtooth was
    // trying (and failing) to provide.
    case "stamp":
      noise({ dur: 0.09, gain: 0.3, from: 2600, to: 900, type: "highpass", attack: 0.02 });
      thump({ from: 320, to: 74, dur: 0.22, gain: 0.34 });
      tone({ freq: 1500, dur: 0.06, gain: 0.09, type: "triangle" });
      break;

    // Air, not tone. A bandpass sweeping up is a car going past; the faint
    // sine on top just gives the whoosh a direction.
    case "dash":
      noise({ dur: 0.4, gain: 0.24, from: 500, to: 3200, q: 1.1, attack: 0.3 });
      tone({ freq: 420, to: 1150, dur: 0.34, gain: 0.06, type: "sine", attack: 0.06 });
      break;

    // A rocket is broadband hiss with a bright leading edge - the pitch is in
    // how the filter moves, never in an oscillator down at 90Hz.
    case "flame":
      noise({ dur: 0.55, gain: 0.3, from: 900, to: 4200, q: 0.8, attack: 0.06 });
      noise({ dur: 0.5, gain: 0.16, from: 260, to: 1100, type: "lowpass", attack: 0.1 });
      thump({ from: 260, to: 96, dur: 0.18, gain: 0.2 });
      tone({ freq: 700, to: 1900, dur: 0.4, gain: 0.05, type: "triangle", attack: 0.05 });
      break;

    // Two soft notes falling a minor third: disappointment, not flatulence.
    case "slump":
      tone({ freq: 494, dur: 0.13, gain: 0.13, type: "sine" });
      tone({ freq: 392, dur: 0.22, gain: 0.12, type: "sine", at: 0.1 });
      break;

    // The special-round KAPOW. A rising sweep announces it, then everything
    // lands together: crack, kick, and a detuned pair ringing on top.
    case "alert":
      noise({ dur: 0.24, gain: 0.14, from: 400, to: 3000, q: 1.4, attack: 0.85 });
      noise({ dur: 0.16, gain: 0.34, from: 3400, to: 800, type: "highpass", attack: 0.02, at: 0.22 });
      thump({ from: 420, to: 62, dur: 0.44, gain: 0.42, at: 0.22 });
      tone({ freq: 587, dur: 0.5, gain: 0.11, type: "triangle", at: 0.24, attack: 0.01 });
      tone({ freq: 587, dur: 0.5, gain: 0.11, type: "triangle", at: 0.24, attack: 0.01, detune: 14 });
      tone({ freq: 880, dur: 0.42, gain: 0.08, type: "triangle", at: 0.3 });
      break;

    // A major arpeggio with a sparkle over it. Kept, but the notes no longer
    // sit on top of a hissing bandpass that swamped them.
    case "finish":
      [523, 659, 784, 1047].forEach((f, i) => {
        tone({ freq: f, dur: 0.3, gain: 0.17, type: "triangle", at: i * 0.09 });
        tone({ freq: f * 2, dur: 0.2, gain: 0.05, type: "sine", at: i * 0.09 });
      });
      tone({ freq: 1047, dur: 0.7, gain: 0.13, type: "triangle", at: 0.4 });
      noise({ dur: 0.5, gain: 0.07, from: 3000, to: 7000, type: "highpass", attack: 0.3, at: 0.4 });
      break;
  }
}
