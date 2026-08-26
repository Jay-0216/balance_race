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

export const THEMES: Theme[] = [
  {
    id: "school", name: "새벽 학교",
    sky: ["#0c1420", "#213049", "#4b4767"],
    bands: ["#141d2a", "#1b2536", "#0c1117"],
    road: ["#4a5a65", "#333f49", "#5f7079"],
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
    sky: ["#070b12", "#131c31", "#2b2752"],
    bands: ["#0f1626", "#161f33", "#070a11"],
    road: ["#3d4852", "#262e36", "#7c8b96"],
    style: "city",
  },
  {
    id: "space", name: "우주",
    sky: ["#020308", "#0a0820", "#1c1038"],
    bands: ["#0a0a18", "#100c22", "#04040e"],
    road: ["#4b3f74", "#2a2340", "#9d8fe0"],
    style: "space",
  },
];

const SPAN = WORLD.w + 900;
const ORIGIN = -450;
const FLOOR = WORLD.h + 400;

function hills(baseY: number, amp: number, stepX: number) {
  let d = `M ${ORIGIN} ${FLOOR} L ${ORIGIN} ${baseY}`;
  for (let x = ORIGIN; x < ORIGIN + SPAN; x += stepX) {
    const peak = baseY - amp * (0.6 + (((x - ORIGIN) / stepX) % 3) * 0.2);
    d += ` Q ${x + stepX / 2} ${peak} ${x + stepX} ${baseY}`;
  }
  return d + ` L ${ORIGIN + SPAN} ${FLOOR} Z`;
}

function city(baseY: number, maxH: number, stepX: number) {
  let d = `M ${ORIGIN} ${FLOOR} L ${ORIGIN} ${baseY}`;
  let x = ORIGIN;
  let i = 0;
  while (x < ORIGIN + SPAN) {
    const w = stepX * (0.55 + ((i * 3) % 5) * 0.16);
    const h = maxH * (0.32 + ((i * 7) % 9) * 0.085);
    d += ` L ${x} ${baseY - h} L ${x + w} ${baseY - h} L ${x + w} ${baseY}`;
    x += w + stepX * 0.22;
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
const STARS = Array.from({ length: 90 }, (_, i) => ({
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
