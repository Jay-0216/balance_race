import { LEAD_CELLS, ROAD_W, TRACK_CELLS, WORLD } from "./world";

/**
 * The race camera, as a real camera in a real 3D space.
 *
 * The old view was a 2D window over a flat drawing: honest, crisp, and unable
 * to ever show the back of a car. A CSS 3D transform could not fix that - it
 * re-projects pixels that were already drawn, which is exactly why it went
 * blurry on a phone. So the world became 3D instead and the picture is drawn
 * from the camera, at the canvas's own resolution, every frame.
 *
 * World axes: +x is across the road (right of centre), +y is up out of the
 * tarmac, +z runs down the road. Cells are the game's own unit; CELL_LEN turns
 * one into world units.
 */

/** world units per cell, taken from the old path so the pack keeps its spacing */
export const CELL_LEN = 28.3;
export const ROAD_HALF = ROAD_W / 2;

export type Cam = {
  x: number; y: number; z: number;
  /** left/right turn. 0 looks down the road. */
  yaw: number;
  /** look down. 0 is level with the tarmac, PI/2 is straight down. */
  pitch: number;
  /** tilt. -PI/2 puts "down the road" along the screen's x axis. */
  roll: number;
  /** focal length, in pixels */
  f: number;
};

export type Proj = {
  sx: number; sy: number;
  /** distance in front of the lens; <= 0 is behind it and must not be drawn */
  depth: number;
  /** pixels per world unit at that depth - sprite scale comes from this */
  scale: number;
};

/**
 * The overhead framing the game is played in.
 *
 * It is a real perspective camera parked very high with a matching focal
 * length, not a separate orthographic mode. Over the ~400 units the race band
 * actually spans, a 4000-unit lens is within a few percent of parallel - the
 * eye cannot tell - and keeping one projection means the intro can travel all
 * the way from the tarmac to here without ever swapping formulas.
 */
export const TOP_HEIGHT = 4000;

/**
 * Visible width of the band, in world units, measured along the road. Taken
 * from the old camera (WORLD.h * aspect) so a game played after this change
 * frames exactly the same amount of road as one played before it.
 */
export function topSpan(px: number, py: number) {
  return py > 0 ? WORLD.h * (px / py) : WORLD.h;
}

/**
 * A shot is where the camera is *pointed*, not where it is.
 *
 * Interpolating raw camera positions was the first thing tried and it does not
 * work: height, angle and lens each move on their own, the subject slides out
 * of frame halfway through, and the opening shot reads as a glitch rather than
 * a move. Framing it as an orbit around a focus point - how far back, how high
 * up, how tilted - keeps whatever the shot is about dead centre for the whole
 * journey, which is the entire difference between a camera move and a lurch.
 */
export type Shot = {
  /** the point the lens is aimed at */
  fx: number; fy: number; fz: number;
  /** how far the lens sits from it */
  dist: number;
  /** 0 is down on the tarmac looking along the road, PI/2 is straight above */
  elev: number;
  /** -PI/2 lays the road along the screen's x axis, the way the game reads it */
  roll: number;
  f: number;
};

/** The overhead framing the game is played in. */
export function topShot(centreCell: number, px: number, py: number, zoom = 1): Shot {
  const span = topSpan(px, py) * zoom;
  return {
    fx: 0, fy: 0, fz: centreCell * CELL_LEN,
    dist: TOP_HEIGHT,
    elev: Math.PI / 2,
    roll: -Math.PI / 2,
    f: (px / span) * TOP_HEIGHT,
  };
}

/**
 * Down on the tarmac behind one car, looking up the road - the opening shot.
 * `x` is the car's real position across the road, road wander included; aiming
 * at the lane offset alone leaves the subject sliding off to one side, because
 * the road itself is rarely where it started.
 */
export function chaseShot(cell: number, x: number, px: number): Shot {
  return {
    fx: x, fy: 11, fz: cell * CELL_LEN,
    dist: 132,
    elev: 0.19,
    roll: 0,
    f: px * 1.05,
  };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Blend two shots. Distance and focal length travel in log space: they cover
 * two orders of magnitude between the tarmac and the overhead shot, and a
 * straight lerp spends the first half of the move already almost at the top.
 */
export function mixShot(a: Shot, b: Shot, t: number): Shot {
  const logMix = (p: number, q: number) => Math.exp(lerp(Math.log(p), Math.log(q), t));
  return {
    fx: lerp(a.fx, b.fx, t),
    fy: lerp(a.fy, b.fy, t),
    fz: lerp(a.fz, b.fz, t),
    dist: logMix(a.dist, b.dist),
    elev: lerp(a.elev, b.elev, t),
    roll: lerp(a.roll, b.roll, t),
    f: logMix(a.f, b.f),
  };
}

/**
 * Put the lens where the shot says, aimed back at the focus. Elevation is the
 * pitch by construction - the camera sits on a circle around the focus and
 * looks along the radius - so there is no separate "look at" solve to drift
 * out of sync with the position.
 */
export function shotCam(s: Shot): Cam {
  return {
    x: s.fx,
    y: s.fy + s.dist * Math.sin(s.elev),
    z: s.fz - s.dist * Math.cos(s.elev),
    yaw: 0,
    pitch: s.elev,
    roll: s.roll,
    f: s.f,
  };
}

/**
 * World point -> screen pixel. Rotation is Rz(roll) . Rx(pitch) . Ry(yaw),
 * applied to the point's offset from the lens.
 *
 * Returns depth as well as position: a caller drawing geometry has to throw
 * away anything at or behind the lens itself, which happens constantly once
 * the camera is down on the road.
 */
export function project(
  cam: Cam, wx: number, wy: number, wz: number, px: number, py: number
): Proj {
  let dx = wx - cam.x, dy = wy - cam.y, dz = wz - cam.z;

  const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
  let x = dx * cy - dz * sy;
  let z = dx * sy + dz * cy;
  let y = dy;

  const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  const y2 = y * cp + z * sp;
  const z2 = -y * sp + z * cp;
  y = y2; z = z2;

  const cr = Math.cos(cam.roll), sr = Math.sin(cam.roll);
  const x3 = x * cr - y * sr;
  const y3 = x * sr + y * cr;
  x = x3; y = y3;

  const depth = z;
  const scale = depth > 0.001 ? cam.f / depth : 0;
  return {
    sx: px / 2 + x * scale,
    sy: py / 2 - y * scale,
    depth,
    scale,
  };
}

/* ---- the road itself ----------------------------------------------------- */

/**
 * Where the centre of the road sits, across, at a given cell. The same gentle
 * deterministic wave the old SVG path was built from, so the track a player
 * knows is still the track they get - it is simply seen from a camera now
 * rather than drawn flat.
 */
export function roadCentre(cell: number): number {
  const c = cell + LEAD_CELLS;
  const seg = (TRACK_CELLS + LEAD_CELLS) / 20;
  const i = Math.floor(c / seg);
  const t = c / seg - i;
  const amp = (n: number) => 20 + ((n * 7) % 13);
  const at = (n: number) => (n % 2 === 0 ? -1 : 1) * amp(n);
  // smoothstep between two control points: the old path was a cubic bezier
  // chain and a linear join here would put a visible crease on every seam
  const s = t * t * (3 - 2 * t);
  return lerp(at(i), at(i + 1), s);
}

/** Height of the tarmac. Flat for now; tracks with hills ride on this. */
export function roadHeight(_cell: number): number {
  return 0;
}

/** A point on the road surface, in world coordinates. */
export function roadPoint(cell: number, lateral: number) {
  return {
    x: roadCentre(cell) + lateral,
    y: roadHeight(cell),
    z: cell * CELL_LEN,
  };
}
