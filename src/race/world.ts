/**
 * The race world, in world units. The mockup was authored landscape; the app
 * is a 9:16 phone, so the numbers are re-derived rather than reused: the
 * camera window is WORLD.h x (WORLD.h * viewAspect), which on a portrait race
 * view is ~260 units wide. At 20.5 units per cell that shows ~13 cells - the
 * pack plus enough road ahead to see who is pulling away.
 */
export const WORLD = { w: 660, h: 250 } as const;

export const CELLS = 40;
export const LANE_GAP = 13;
export const RACER_R = 7;
/**
 * Ambient cruise, world units per second. Cell positions are the score and
 * must never drift, so nothing about the race geometry moves with this - it
 * scrolls the backdrop, the centre line and the dust instead. The cars are
 * always driving; the round only decides who pulls ahead.
 */
export const CRUISE = 40;

/** chassis size in world units - 15px on a phone at the default zoom */
export const CAR = { len: 17, w: 9 } as const;
export const ROAD_W = 112;
/** A half-lane of along-track stagger so neighbouring lanes never touch.
 *  0.125 of a cell - visible separation, no misread of who is ahead. */
export const LANE_STAGGER = 3.5;

export const TRACK_START = 40;
export const TRACK_END = 620;

/** A deterministic wave, so the track is the same every run. */
export function buildTrackPath(): string {
  const segs = 4;
  const step = (TRACK_END - TRACK_START) / segs;
  let y = WORLD.h / 2;
  let d = `M ${TRACK_START} ${y}`;

  for (let i = 0; i < segs; i++) {
    const amp = 18 + ((i * 7) % 14);
    const ny = WORLD.h / 2 + (i % 2 === 0 ? -1 : 1) * amp;
    const x0 = TRACK_START + step * i;
    const x1 = x0 + step;
    d += ` C ${x0 + step * 0.5} ${y} ${x1 - step * 0.5} ${ny} ${x1} ${ny}`;
    y = ny;
  }
  return d;
}

export const RACER_COLORS = [
  "#f0b429", "#9aa9b4", "#7fb89a", "#b79acb",
  "#c9a47e", "#7fa3c9", "#c98fa6", "#a5b87f",
];

export const RACER_NAMES = [
  "나", "무난이", "청개구리", "눈치백단", "도박러", "대충이", "츤츤이", "몰빵이",
];

export type RacerView = {
  id: number;
  name: string;
  color: string;
  me: boolean;
  /** authoritative position in cells */
  pos: number;
};

export function makeRacers(): RacerView[] {
  return RACER_NAMES.map((name, id) => ({
    id,
    name,
    color: RACER_COLORS[id],
    me: id === 0,
    pos: 0,
  }));
}
