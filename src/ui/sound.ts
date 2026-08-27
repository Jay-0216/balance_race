/**
 * Every sound in the game is synthesised on the spot with Web Audio - there
 * are no audio files to download, nothing to 404, and the whole thing costs a
 * couple of kilobytes. A phone game that has to fetch a sprite sheet of sounds
 * before the first round feels broken on a bad connection.
 *
 * An AudioContext cannot start before a user gesture, so this stays unbuilt
 * until the first play() call and silently does nothing if it is refused.
 */
export type Sfx =
  | "click"      // a choice is committed
  | "tick"       // the last three seconds
  | "stamp"      // the majority is revealed
  | "dash"       // the winners pull away
  | "flame"      // a booster fires
  | "slump"      // the minority stays put
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
  if (master && ctx) master.gain.setTargetAtTime(next ? 0 : 0.9, ctx.currentTime, 0.02);
}

function audio() {
  if (ctx) return ctx;
  try {
    const Ctor = window.AudioContext ?? (window as unknown as {
      webkitAudioContext: typeof AudioContext;
    }).webkitAudioContext;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.9;
    master.connect(ctx.destination);
  } catch {
    ctx = null;
  }
  return ctx;
}

/** one short tone with an exponential tail */
function tone(
  freq: number,
  dur: number,
  type: OscillatorType,
  gain: number,
  at = 0,
  glideTo?: number
) {
  const c = audio();
  if (!c || !master) return;
  const t0 = c.currentTime + at;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/** filtered white noise - wind, dust, the hiss of a flare */
function noise(dur: number, gain: number, from: number, to: number, at = 0) {
  const c = audio();
  if (!c || !master) return;
  const t0 = c.currentTime + at;
  const frames = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, frames, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;

  const src = c.createBufferSource();
  src.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(from, t0);
  filter.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  filter.Q.value = 0.9;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + dur * 0.15);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter).connect(g).connect(master);
  src.start(t0);
}

export function play(sfx: Sfx) {
  if (muted) return;
  switch (sfx) {
    case "click":
      tone(660, 0.07, "triangle", 0.22);
      break;
    case "tick":
      tone(1180, 0.045, "square", 0.08);
      break;
    case "stamp":
      tone(150, 0.16, "sawtooth", 0.3, 0, 60);
      noise(0.16, 0.16, 1600, 260);
      break;
    case "dash":
      noise(0.42, 0.2, 380, 2600);
      tone(180, 0.3, "sawtooth", 0.12, 0, 520);
      break;
    case "flame":
      noise(0.62, 0.3, 240, 3400);
      tone(90, 0.5, "sawtooth", 0.22, 0, 320);
      break;
    case "slump":
      tone(320, 0.18, "sine", 0.16, 0, 170);
      break;
    case "finish":
      [0, 0.1, 0.2, 0.34].forEach((at, i) => {
        tone([523, 659, 784, 1047][i], 0.28, "triangle", 0.24, at);
      });
      noise(0.7, 0.14, 900, 5200, 0.1);
      break;
  }
}
