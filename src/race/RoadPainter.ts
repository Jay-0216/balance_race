import { CELL_LEN, ROAD_HALF, project, roadPoint, type Cam } from "./cam3d";
import { CELLS, ROAD_W } from "./world";

/**
 * Draws the tarmac, every frame, from wherever the camera happens to be.
 *
 * The layers are the ones the old SVG track had - kerb, edge, surface, sheen,
 * centre dashes - in the same order and the same widths, because the whole
 * point of this first step is that a player cannot tell the renderer changed
 * until the camera starts moving.
 *
 * Nothing outside the road is painted. The backdrop is a layer of its own
 * underneath, so leaving the canvas transparent there keeps it visible exactly
 * as before.
 */

const KERB_HALF = (ROAD_W + 15) / 2;
const EDGE_HALF = (ROAD_W + 7) / 2;
const SHEEN_HALF = (ROAD_W * 0.55) / 2;

/** how finely the road is cut up along its length, in cells, right in front */
const STEP = 0.4;
/** anything nearer than this is behind the lens, or close enough to explode */
const NEAR = 6;
/**
 * Steps grow with distance. A road drawn all the way to the horizon at the
 * near step would be thousands of slices, nearly all of them landing inside
 * the same pixel row; doubling the step every eight cells costs nothing the
 * eye can find and keeps the whole strip at a couple of hundred points.
 */
const growth = (d: number) => STEP * (1 + Math.max(0, d) / 8);

/** Detail that is pointless past a few car lengths: teeth, dashes, ticks. */
const DETAIL_REACH = 34;

export type RoadColors = {
  /** edge, surface, centre dashes - mixed across themes by the caller */
  edge: string;
  surface: string;
  dash: string;
};

type Strip = { from: number; to: number };

/**
 * The stretch of road worth drawing. Far enough ahead to reach the horizon
 * when the camera is down on the tarmac, and far enough back to fill the band
 * when it is overhead - the overhead shot sees road on both sides of its own
 * position, the chase shot only ever sees what is in front.
 */
function visible(cam: Cam, baseCell: number, span: number): Strip {
  const reach = span / CELL_LEN;
  // Always start well behind the subject. Trimming the near end by camera
  // angle was a false economy: it left the tarmac ending in a straight vertical
  // cut partway across the overhead view, and points behind the lens are
  // thrown away by the projection anyway, so the only thing the trim saved was
  // a handful of arithmetic.
  return {
    from: baseCell - reach,
    // Low down, the road has to run to the horizon or it ends in mid-air with
    // sky underneath it - which is exactly what the first attempt looked like.
    to: baseCell + reach * (cam.pitch > 1.2 ? 1.2 : 9),
  };
}

/**
 * One filled ribbon down the road: out along the left edge, back along the
 * right. Building it as a single path rather than a quad per step is what
 * keeps the seams from showing - abutting fills leave hairlines wherever the
 * edges land between pixels.
 */
function ribbon(
  ctx: CanvasRenderingContext2D, cam: Cam, px: number, py: number,
  strip: Strip, half: number, fill: string, offset: number, ref: number
) {
  const left: { sx: number; sy: number }[] = [];
  const right: { sx: number; sy: number }[] = [];

  // Steps coarsen with distance *from the subject*, not from the start of the
  // strip: the strip now begins well behind the camera, and measuring from
  // there would have the road already coarse by the time it reaches the car.
  for (let c = strip.from; c <= strip.to; c += growth(c - ref)) {
    const a = roadPoint(c + offset, -half);
    const b = roadPoint(c + offset, half);
    const pa = project(cam, a.x, a.y, a.z, px, py);
    const pb = project(cam, b.x, b.y, b.z, px, py);
    if (pa.depth < NEAR || pb.depth < NEAR) continue;
    left.push(pa);
    right.push(pb);
  }
  if (left.length < 2) return;

  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(left[0].sx, left[0].sy);
  for (let i = 1; i < left.length; i++) ctx.lineTo(left[i].sx, left[i].sy);
  for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i].sx, right[i].sy);
  ctx.closePath();
  ctx.fill();
}

/** A flat rectangle lying on the tarmac: dashes, kerb teeth, lines, flags. */
function patch(
  ctx: CanvasRenderingContext2D, cam: Cam, px: number, py: number,
  cell: number, len: number, from: number, to: number, fill: string
) {
  const corners = [
    roadPoint(cell, from), roadPoint(cell, to),
    roadPoint(cell + len, to), roadPoint(cell + len, from),
  ];
  const pts = corners.map((c) => project(cam, c.x, c.y, c.z, px, py));
  if (pts.some((p) => p.depth < NEAR)) return;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(pts[0].sx, pts[0].sy);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].sx, pts[i].sy);
  ctx.closePath();
  ctx.fill();
}

export type RoadScene = {
  /** centre of interest, in cells, cruise already added */
  centre: number;
  /** ambient forward drift shared by everything on the road */
  cruise: number;
  colors: RoadColors;
  /** visible width along the road in world units, for sizing the draw window */
  span: number;
  ticks: number[];
  /** the verge either side of the tarmac, for when the camera is low */
  ground: string;
};

export function drawRoad(
  ctx: CanvasRenderingContext2D, cam: Cam, px: number, py: number, s: RoadScene
) {
  ctx.clearRect(0, 0, px, py);
  // Everything below works in *score* cells and is shifted onto the road by
  // `off` at the last moment, the way the cars are. `s.centre` is where the
  // camera is, in world cells, so it already contains the cruise - laying the
  // strip out from it and then adding the cruise again drags the whole road
  // forward by however long the game has been running, which on screen is the
  // tarmac ending in a straight vertical cut partway across the view. It only
  // ever looked right in a race that had just started.
  const off = s.cruise;
  const base = s.centre - off;
  const strip = visible(cam, base, s.span);
  const detailTo = Math.min(strip.to, base + DETAIL_REACH);

  // Ground either side, but only once the camera is low enough to see past
  // the tarmac. From overhead the backdrop is the scenery and always has
  // been; painting a verge up there would bury it.
  const low = Math.max(0, Math.min(1, (1.15 - cam.pitch) / 0.45));
  if (low > 0) {
    ctx.globalAlpha = low;
    ribbon(ctx, cam, px, py, strip, KERB_HALF * 11, s.ground, off, base);
    ctx.globalAlpha = 1;
  }

  // kerbs: white all the way down, then red teeth on alternate steps - the
  // old track got this from one dashed stroke over a solid one
  ribbon(ctx, cam, px, py, strip, KERB_HALF, "#d8dee2", off, base);
  const tooth = STEP * 2;
  const first = Math.ceil(strip.from / tooth) * tooth;
  for (let c = first; c < detailTo; c += tooth * 2) {
    patch(ctx, cam, px, py, c + off, tooth, -KERB_HALF, -EDGE_HALF + 1, "#c8564a");
    patch(ctx, cam, px, py, c + off, tooth, EDGE_HALF - 1, KERB_HALF, "#c8564a");
  }

  ribbon(ctx, cam, px, py, strip, EDGE_HALF, s.colors.edge, off, base);
  ribbon(ctx, cam, px, py, strip, ROAD_HALF, s.colors.surface, off, base);

  // a soft sheen down the middle, so a wide road is not a flat slab
  ctx.globalAlpha = 0.045;
  ribbon(ctx, cam, px, py, strip, SHEEN_HALF, "#ffffff", off, base);
  ctx.globalAlpha = 1;

  // centre dashes - 10 on, 15 off in world units, as they were
  const on = 10 / CELL_LEN, period = 25 / CELL_LEN;
  const d0 = Math.ceil(strip.from / period) * period;
  for (let c = d0; c < detailTo; c += period) {
    patch(ctx, cam, px, py, c + off, on, -0.8, 0.8, s.colors.dash);
  }

  // start line, distance ticks, chequered finish
  patch(ctx, cam, px, py, off, 2 / CELL_LEN, -ROAD_HALF, ROAD_HALF, "#6d7f8b");
  for (const t of s.ticks) {
    if (t >= CELLS) continue;
    patch(ctx, cam, px, py, t + off, 1.4 / CELL_LEN, -ROAD_HALF, ROAD_HALF, "#4c5b66");
  }
  const flagLen = 10 / CELL_LEN;
  for (let r = 0; r < 8; r++) {
    patch(
      ctx, cam, px, py, CELLS + off - flagLen / 2, flagLen,
      -ROAD_HALF + (r * ROAD_W) / 8, -ROAD_HALF + ((r + 1) * ROAD_W) / 8,
      r % 2 ? "#0e141a" : "#e9eef1"
    );
  }
}
