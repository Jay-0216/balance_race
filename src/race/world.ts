/**
 * The race world, in world units. The mockup was authored landscape; the app
 * is a 9:16 phone, so the numbers are re-derived rather than reused: the
 * camera window is WORLD.h x (WORLD.h * viewAspect), which on a portrait race
 * view is ~260 units wide. At 20.5 units per cell that shows ~13 cells - the
 * pack plus enough road ahead to see who is pulling away.
 */
export const WORLD = { w: 5760, h: 250 } as const;

/**
 * The finish line is the rules' finish line. These were two separate numbers
 * for a while - 40 here, 24 there - so the chequered flag was painted 16 cells
 * past where the game actually ended, and the last backdrop theme (which keys
 * off lead/CELLS) could never fully arrive.
 */
export { CELLS } from "../game/rules";
/**
 * Car, lane and road are one set of proportions, taken straight from the
 * mockup (which was authored against a 240-unit world) and scaled to this
 * one. Re-deriving them by eye made the pack too small for a road too narrow:
 * eight cars 13 apart on a 112 road left the outside lanes riding the kerb,
 * and a 17-unit car is barely 20px on a phone - too small for the wing, the
 * cockpit or the nose highlight to survive.
 */
export const LANE_GAP = 17.7;
export const RACER_R = 7;
/**
 * Ambient cruise in cells per second. Everything on the track - cars, distance
 * ticks, the finish line - is drawn at (score + cruise), so the whole field
 * genuinely drives forward together while the gaps between them stay exactly
 * the score. Scrolling only the backdrop looked wrong the moment anyone was at
 * the start line, and worse on a curve, where "sideways" is not "forward".
 */
export const CRUISE = 0.25;

/** chassis size in world units - ~34px on a phone at the default zoom */
export const CAR = { len: 27, w: 13.5 } as const;
/** the road surface; the edge underneath it is drawn 7 wider */
export const ROAD_W = 129;

/**
 * The track is far longer than the 20 cells anyone scores, because the cars
 * physically drive down it the whole time. TRACK_CELLS worth of road at ~10
 * minutes of cruising is plenty for one game.
 */
export const TRACK_CELLS = 200;
/** road drawn behind cell 0, so the start line is never the end of the road */
export const LEAD_CELLS = 12;
export const TRACK_START = -300;
export const TRACK_END = 5700;

/** A deterministic wave, so the track is the same every run. */
export function buildTrackPath(): string {
  const segs = 20;
  const step = (TRACK_END - TRACK_START) / segs;
  let y = WORLD.h / 2;
  let d = `M ${TRACK_START} ${y}`;

  for (let i = 0; i < segs; i++) {
    // gentle: the camera does not track vertically, so a steep road would
    // swing the cars up and down the band
    const amp = 20 + ((i * 7) % 13);
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
