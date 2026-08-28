import { WORLD } from "./world";

/**
 * Four themed backdrops stacked on top of each other. The engine cross-fades
 * their opacity from the leader's progress, so "how far have we come" is
 * legible without reading a number - which is the whole point of the parallax.
 *
 * Every theme keeps the same three-band structure, so the parallax factors and
 * the road palette never have to change with it.
 */
export const PARALLAX_FACTORS = { far: 0.2, mid: 0.5, near: 1.2 };

export type ThemeStyle = "hills" | "city" | "space";

export type Theme = {
  id: string;
  name: string;
  sky: [string, string, string];
  bands: [string, string, string];
  /** edge, surface, centre dashes - the road has to stay a road in every theme */
  road: [string, string, string];
  style: ThemeStyle;
};

/**
 * Every band is built as an exact repetition of a tile, so the engine can
 * scroll it forever by offsetting modulo the tile width. Without that the
 * ambient cruise would eventually run off the end of the geometry.
 */
export function tileWidth(style: ThemeStyle, layer: 0 | 1 | 2) {
  if (layer === 2) return 3 * 64;
  if (style === "city") return layer === 0 ? cityTile(52) : cityTile(34);
  if (style === "space") return 3 * (layer === 0 ? 220 : 140);
  return 3 * (layer === 0 ? 190 : 118);
}

export const THEMES: Theme[] = [
  {
    id: "school", name: "이른 아침 학교",
    sky: ["#26405f", "#4a6d94", "#9d7fa0"],
    bands: ["#2c4055", "#35495e", "#1d2a37"],
    road: ["#5e7180", "#44535f", "#7b8d99"],
    style: "hills",
  },
  {
    id: "field", name: "한낮 운동장",
    sky: ["#3a6f9e", "#7aabcb", "#bad3df"],
    bands: ["#4f7b87", "#3d626c", "#24383f"],
    road: ["#9aa6ae", "#6d7a85", "#e2e7ea"],
    style: "hills",
  },
  {
    id: "city", name: "도시 밤",
    sky: ["#141d31", "#233158", "#463f7d"],
    bands: ["#1d2740", "#26314c", "#141a28"],
    road: ["#4c5a68", "#343f4b", "#8b9aa6"],
    style: "city",
  },
  {
    id: "space", name: "우주",
    sky: ["#0c0d1c", "#191436", "#33205c"],
    bands: ["#161629", "#1e1838", "#0d0d1c"],
    road: ["#5b4d8a", "#372e52", "#ab9ef0"],
    style: "space",
  },
];

const SPAN = WORLD.w + 1800;
const ORIGIN = -600;
const FLOOR = WORLD.h + 400;

function hills(baseY: number, amp: number, stepX: number) {
  let d = `M ${ORIGIN} ${FLOOR} L ${ORIGIN} ${baseY}`;
  let n = 0;
  for (let x = ORIGIN; x < ORIGIN + SPAN; x += stepX) {
    const peak = baseY - amp * (0.6 + (n % 3) * 0.2);   // period: 3 steps
    d += ` Q ${x + stepX / 2} ${peak} ${x + stepX} ${baseY}`;
    n++;
  }
  return d + ` L ${ORIGIN + SPAN} ${FLOOR} Z`;
}

// fixed five-building pattern, so the skyline repeats on an exact width
const CITY_W = [0.9, 0.62, 1.05, 0.75, 0.88];
const CITY_H = [0.55, 0.88, 0.38, 0.72, 0.98];
const CITY_GAP = 0.22;

function cityTile(stepX: number) {
  return stepX * (CITY_W.reduce((a, b) => a + b, 0) + CITY_W.length * CITY_GAP);
}

function city(baseY: number, maxH: number, stepX: number) {
  let d = `M ${ORIGIN} ${FLOOR} L ${ORIGIN} ${baseY}`;
  let x = ORIGIN;
  let i = 0;
  while (x < ORIGIN + SPAN) {
    const w = stepX * CITY_W[i % CITY_W.length];
    const h = maxH * CITY_H[i % CITY_H.length];
    d += ` L ${x} ${baseY - h} L ${x + w} ${baseY - h} L ${x + w} ${baseY}`;
    x += w + stepX * CITY_GAP;
    i++;
  }
  return d + ` L ${ORIGIN + SPAN} ${FLOOR} Z`;
}

function band(style: ThemeStyle, layer: 0 | 1 | 2) {
  if (layer === 2) return hills(WORLD.h + 4, 16, 64);
  if (style === "city") {
    return layer === 0 ? city(112, 84, 52) : city(154, 46, 34);
  }
  if (style === "space") {
    return layer === 0 ? hills(148, 34, 220) : hills(178, 22, 140);
  }
  return layer === 0 ? hills(112, 74, 190) : hills(154, 44, 118);
}

/** deterministic star field, so it does not shimmer between renders */
const STARS = Array.from({ length: 130 }, (_, i) => ({
  x: ORIGIN + ((i * 137) % SPAN),
  y: 6 + ((i * 53) % 130),
  r: 0.5 + ((i * 17) % 5) * 0.22,
  o: 0.3 + ((i * 29) % 7) * 0.1,
}));

export type BandRef = (el: SVGGElement | null) => void;

export default function Backdrop({
  themeRef,
  bandRef,
}: {
  themeRef: (i: number) => (el: SVGGElement | null) => void;
  bandRef: (i: number, layer: 0 | 1 | 2) => BandRef;
}) {
  return (
    <>
      {THEMES.map((t, i) => (
        <g key={t.id} ref={themeRef(i)} opacity={i === 0 ? 1 : 0}>
          <defs>
            <linearGradient id={`sky-${t.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={t.sky[0]} />
              <stop offset="0.58" stopColor={t.sky[1]} />
              <stop offset="1" stopColor={t.sky[2]} />
            </linearGradient>
          </defs>
          <rect
            x={-600} y={-400} width={WORLD.w + 1600} height={WORLD.h + 900}
            fill={`url(#sky-${t.id})`}
          />

          {t.style === "space" && (
            <g ref={bandRef(i, 0)}>
              {STARS.map((s, n) => (
                <circle key={n} cx={s.x} cy={s.y} r={s.r} fill="#dfe6ff" opacity={s.o} />
              ))}
              <path d={band(t.style, 0)} fill={t.bands[0]} />
            </g>
          )}
          {t.style !== "space" && (
            <g ref={bandRef(i, 0)}>
              <path d={band(t.style, 0)} fill={t.bands[0]} />
            </g>
          )}

          <g ref={bandRef(i, 1)}>
            <path d={band(t.style, 1)} fill={t.bands[1]} />
          </g>
          <g ref={bandRef(i, 2)}>
            <path d={band(t.style, 2)} fill={t.bands[2]} opacity={0.95} />
          </g>
        </g>
      ))}
    </>
  );
}

/** Weighted RGB mix - used to carry the road palette across a theme change. */
export function mixColors(hexes: string[], weights: number[]) {
  let r = 0, g = 0, b = 0, total = 0;
  for (let i = 0; i < hexes.length; i++) {
    const w = weights[i];
    if (w <= 0) continue;
    const v = parseInt(hexes[i].slice(1), 16);
    r += ((v >> 16) & 255) * w;
    g += ((v >> 8) & 255) * w;
    b += (v & 255) * w;
    total += w;
  }
  if (total === 0) return hexes[0];
  const to = (n: number) => Math.round(n / total).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

/**
 * Cross-fade weights for a progress value in 0..1. Adjacent themes overlap so
 * the change is a dissolve, never a cut.
 */
export function themeWeights(progress: number): number[] {
  const f = Math.max(0, Math.min(1, progress)) * (THEMES.length - 1);
  return THEMES.map((_, i) => Math.max(0, 1 - Math.abs(f - i)));
}
