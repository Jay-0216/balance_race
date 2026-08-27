import { useEffect, useLayoutEffect, useRef } from "react";
import { Camera } from "./Camera";
import { Particles } from "./Particles";
import Backdrop, { PARALLAX_FACTORS, THEMES, mixColors, themeWeights } from "./Backdrop";
import Markers, { TICKS } from "./Markers";
import type { RaceEffect } from "./effects";
import Car from "./Racer";
import Track from "./Track";
import {
  CAR, CELLS, CRUISE, LANE_GAP, LANE_STAGGER, LEAD_CELLS, TRACK_CELLS, WORLD,
  type RacerView,
} from "./world";
import "./RaceView.css";

const MOVE_MS = 800;
const EASE = (k: number) => 1 - Math.pow(1 - k, 3);

type Tween = { from: number; to: number; t0: number };

type Node = {
  root: SVGGElement | null;
  spin: SVGGElement | null;
  squash: SVGGElement | null;
};

export default function RaceView({
  racers,
  effects,
  paused,
  onFps,
}: {
  racers: RacerView[];
  /** one-shot flourishes: a gust for the winners, a flare for a booster */
  effects?: RaceEffect[];
  /**
   * Stops the loop entirely. The result overlay sits on a backdrop-filter, and
   * blurring a canvas that is still repainting at 60fps costs more than the
   * race itself - it took the whole screen down to 25fps.
   */
  paused?: boolean;
  onFps?: (fps: number) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const measureRef = useRef<SVGPathElement | null>(null);
  const nodesRef = useRef<Node[]>([]);
  const roadRefs = useRef<(SVGPathElement | null)[]>([null, null, null]);
  const themeRefs = useRef<(SVGGElement | null)[]>([]);
  const bandRefs = useRef<(SVGGElement | null)[][]>(THEMES.map(() => [null, null, null]));

  const camRef = useRef(new Camera());
  const fxRef = useRef(new Particles());
  const drawRef = useRef<number[]>(racers.map((r) => r.pos));
  const prevRef = useRef<number[]>(racers.map((r) => r.pos));
  const tweenRef = useRef<(Tween | null)[]>(racers.map(() => null));
  const racersRef = useRef(racers);

  const tickRefs = useRef<(SVGGElement | null)[]>([]);
  const startRef = useRef<SVGGElement | null>(null);
  const finishRef = useRef<SVGGElement | null>(null);
  const activeFx = useRef<{ playerId: number; kind: RaceEffect["kind"]; until: number }[]>([]);
  const seenFx = useRef(new Set<number>());

  const reduce =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Start a tween whenever an authoritative position changes. Positions live in
  // React state; the on-screen value is animated outside React so a moving pack
  // never costs a render.
  useLayoutEffect(() => {
    racersRef.current = racers;
    const now = performance.now();
    racers.forEach((r, i) => {
      if (drawRef.current[i] === undefined) drawRef.current[i] = r.pos;
      const tw = tweenRef.current[i];
      const target = tw ? tw.to : drawRef.current[i];
      if (target !== r.pos) {
        tweenRef.current[i] = { from: drawRef.current[i], to: r.pos, t0: now };
      }
    });
  }, [racers]);

  useEffect(() => {
    if (!effects?.length) return;
    const now = performance.now();
    for (const e of effects) {
      if (seenFx.current.has(e.key)) continue;
      seenFx.current.add(e.key);
      activeFx.current.push({
        playerId: e.playerId,
        kind: e.kind,
        until: now + (e.kind === "booster" ? 950 : 700),
      });
    }
    if (seenFx.current.size > 400) seenFx.current.clear();
  }, [effects]);

  useEffect(() => {
    const box = boxRef.current;
    const svg = svgRef.current;
    const canvas = canvasRef.current;
    const measure = measureRef.current;
    if (!box || !svg || !canvas || !measure) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cam = camRef.current;
    const fx = fxRef.current;
    const len = measure.getTotalLength();
    const cellLen = len / (TRACK_CELLS + LEAD_CELLS);

    /*
     * The path is sampled once into a table and looked up by interpolation.
     * getPointAtLength is a real cost at this volume - a hundred wind streaks
     * asking for two points each, every frame, was the last thing holding the
     * dash below 60fps. At four samples per cell the error on a road this
     * gentle is far under a pixel.
     */
    const PER_CELL = 4;
    const total = (TRACK_CELLS + LEAD_CELLS) * PER_CELL + 2;
    const sx0 = new Float32Array(total);
    const sy0 = new Float32Array(total);
    const sang = new Float32Array(total);
    for (let i = 0; i < total; i++) {
      const l = Math.min(len - 0.5, (i / PER_CELL) * cellLen);
      const a = measure.getPointAtLength(l);
      const b = measure.getPointAtLength(Math.min(len, l + 1));
      sx0[i] = a.x;
      sy0[i] = a.y;
      sang[i] = Math.atan2(b.y - a.y, b.x - a.x);
    }

    // cell 0 sits LEAD_CELLS into the path, so there is road behind the grid
    const at = (cells: number) => {
      const f = Math.max(0, Math.min(total - 2, (cells + LEAD_CELLS) * PER_CELL));
      const i = f | 0;
      const t = f - i;
      return {
        x: sx0[i] + (sx0[i + 1] - sx0[i]) * t,
        y: sy0[i] + (sy0[i + 1] - sy0[i]) * t,
        ang: sang[i],
      };
    };

    let px = 0, py = 0, dpr = 1;
    const resize = () => {
      const r = box.getBoundingClientRect();
      px = r.width; py = r.height;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(px * dpr));
      canvas.height = Math.max(1, Math.round(py * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cam.setAspect(px, py);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(box);

    // world -> css pixels. preserveAspectRatio is "none" and the viewBox keeps
    // the box's aspect, so this stays a plain linear map.
    let vbX = 0, vbY = 0, vbW = 1, vbH = 1;
    const sx = (x: number) => ((x - vbX) / vbW) * px;
    const sy = (y: number) => ((y - vbY) / vbH) * py;

    const factors = [PARALLAX_FACTORS.far, PARALLAX_FACTORS.mid, PARALLAX_FACTORS.near];

    let raf = 0;
    let frames = 0;
    let fpsAt = performance.now();
    const t0 = performance.now();

    const frame = (now: number) => {
      const list = racersRef.current;

      // Everything on the road - cars, ticks, the finish - is drawn at
      // (score + cruise), so the field genuinely drives forward while the gaps
      // between them stay exactly the score.
      const cruise = reduce
        ? 0
        : Math.min(TRACK_CELLS - CELLS - 4, ((now - t0) / 1000) * CRUISE);

      for (let i = 0; i < list.length; i++) {
        const tw = tweenRef.current[i];
        if (!tw) continue;
        const k = reduce ? 1 : Math.min(1, (now - tw.t0) / MOVE_MS);
        drawRef.current[i] = tw.from + (tw.to - tw.from) * EASE(k);
        if (k >= 1) tweenRef.current[i] = null;
      }

      let lead = 0, last = Infinity;
      for (let i = 0; i < list.length; i++) {
        const d = drawRef.current[i] ?? 0;
        if (d > lead) lead = d;
        if (d < last) last = d;
      }
      const leadPt = at(lead + cruise);
      const lastPt = at(last + cruise);
      cam.update(leadPt.x, lastPt.x, !reduce);

      const vb = cam.viewBox().split(" ").map(Number);
      vbX = vb[0]; vbY = vb[1]; vbW = vb[2]; vbH = vb[3];
      svg.setAttribute("viewBox", cam.viewBox());

      const camX = cam.x;
      // theme follows the leader: the backdrop IS the progress bar
      const weights = themeWeights(lead / CELLS);
      for (let part = 0; part < 3; part++) {
        roadRefs.current[part]?.setAttribute(
          "stroke",
          mixColors(THEMES.map((t) => t.road[part]), weights)
        );
      }
      for (let t = 0; t < THEMES.length; t++) {
        const g = themeRefs.current[t];
        if (g) g.setAttribute("opacity", weights[t].toFixed(3));
        if (weights[t] <= 0) continue;
        for (let b = 0; b < 3; b++) {
          bandRefs.current[t][b]?.setAttribute(
            "transform",
            `translate(${camX * (1 - factors[b])} 0)`
          );
        }
      }

      for (let i = 0; i < TICKS.length; i++) {
        const g = tickRefs.current[i];
        if (!g) continue;
        const mp = at(TICKS[i] + cruise);
        g.setAttribute("transform", `translate(${mp.x} ${mp.y}) rotate(${(mp.ang * 180) / Math.PI})`);
      }
      if (startRef.current) {
        const sp = at(cruise);
        startRef.current.setAttribute(
          "transform",
          `translate(${sp.x} ${sp.y}) rotate(${(sp.ang * 180) / Math.PI})`
        );
      }
      if (finishRef.current) {
        const fp = at(CELLS + cruise);
        finishRef.current.setAttribute(
          "transform",
          `translate(${fp.x} ${fp.y}) rotate(${(fp.ang * 180) / Math.PI})`
        );
      }

      const seats = new Map<
        number,
        { x: number; y: number; ang: number; cell: number; lateral: number }
      >();

      for (let i = 0; i < list.length; i++) {
        const node = nodesRef.current[i];
        if (!node?.root) continue;

        const d = drawRef.current[i] ?? 0;
        const lane = i - (list.length - 1) / 2;
        // A touch of jostle so the pack is never a rigid formation - they
        // trade half a cell back and forth the whole way down the road.
        const jostle = reduce
          ? 0
          : Math.sin(now / (620 + i * 47) + i * 2.1) * 0.16 +
            Math.sin(now / (1130 + i * 83) + i) * 0.09;
        const p = at(d + cruise + jostle);
        const nx = -Math.sin(p.ang), ny = Math.cos(p.ang);
        const stagger = (i % 2 === 0 ? 1 : -1) * LANE_STAGGER;
        const wx = p.x + nx * lane * LANE_GAP + Math.cos(p.ang) * stagger;
        const wy = p.y + ny * lane * LANE_GAP + Math.sin(p.ang) * stagger;

        seats.set(list[i].id, {
          x: sx(wx), y: sy(wy), ang: p.ang,
          cell: d + cruise + jostle, lateral: lane * LANE_GAP,
        });
        node.root.setAttribute("transform", `translate(${wx} ${wy})`);
        node.spin?.setAttribute("transform", `rotate(${(p.ang * 180) / Math.PI})`);

        // squash & stretch along the direction of travel - a few lines of
        // transform that buy most of the perceived weight
        const speed = Math.min(1, Math.abs(d - (prevRef.current[i] ?? d)) / 0.055);
        prevRef.current[i] = d;
        // A car stretching along its own length reads as motion blur, so this
        // can be pushed much further than it could on a circle.
        // The bob rides on top of the squash so a car at rest still looks
        // like it is running.
        if (!reduce && node.squash) {
          const bob = Math.sin(now / 130 + i * 1.7) * 0.4;
          node.squash.setAttribute(
            "transform",
            `translate(0 ${bob}) scale(${1 + speed * 0.62} ${1 - speed * 0.28})`
          );
        }

        if (!reduce) {
          // spawn behind the racer, not on top of it
          const bx = wx - Math.cos(p.ang) * (CAR.len * 0.6);
          const by = wy - Math.sin(p.ang) * (CAR.len * 0.6);
          // a trickle of dust even at rest, so nobody ever looks parked
          if (Math.random() < 0.07 + speed * 0.63) fx.dust(sx(bx), sy(by), 1, "#6b7d89");
          if (speed > 0.35) {
            const scale = px / vbW;
            fx.trail(sx(bx), sy(by), CAR.w * scale * 0.42, list[i].color);
          }
          if (speed > 0.6 && Math.random() < 0.35) {
            fx.speedLine(sx(wx), sy(wy), list[i].color);
          }
        }
      }

      // one-shot flourishes: a gust behind whoever won the round, a flare for
      // a booster. They ride on top of the ordinary dust, never replace it.
      if (!reduce && activeFx.current.length) {
        activeFx.current = activeFx.current.filter((e) => e.until > now);
        // boosters first: they must never be starved of pool slots by the
        // gusts firing in the same frame
        for (const e of activeFx.current) {
          if (e.kind !== "booster") continue;
          const seat = seats.get(e.playerId);
          if (!seat) continue;
          fx.flame(
            seat.x - Math.cos(seat.ang) * 13,
            seat.y - Math.sin(seat.ang) * 13,
            seat.ang, 12
          );
        }
        for (const e of activeFx.current) {
          if (e.kind !== "advance") continue;
          const seat = seats.get(e.playerId);
          if (!seat) continue;
          fx.wind(seat.cell - 0.42, seat.lateral, 3);
        }
      }

      if (!reduce) {
        fx.draw(ctx, px, py, (cell, lateral) => {
          const q = at(cell);
          const nx = -Math.sin(q.ang), ny = Math.cos(q.ang);
          return {
            x: sx(q.x + nx * lateral),
            y: sy(q.y + ny * lateral),
            angle: q.ang,
          };
        });
      }

      frames++;
      if (now - fpsAt >= 500) {
        onFps?.(Math.round((frames * 1000) / (now - fpsAt)));
        frames = 0;
        fpsAt = now;
      }

      if (!paused) raf = requestAnimationFrame(frame);
    };

    if (!paused) raf = requestAnimationFrame(frame);
    else frame(performance.now());        // one last paint, then stop

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [reduce, onFps, paused]);

  const setNode = (i: number, k: keyof Node) => (el: SVGGElement | null) => {
    nodesRef.current[i] = nodesRef.current[i] ?? { root: null, spin: null, squash: null };
    nodesRef.current[i][k] = el;
  };

  const setRoad = (part: 0 | 1 | 2) => (el: SVGPathElement | null) => {
    roadRefs.current[part] = el;
  };

  const setTheme = (i: number) => (el: SVGGElement | null) => {
    themeRefs.current[i] = el;
  };

  const setBand = (i: number, layer: 0 | 1 | 2) => (el: SVGGElement | null) => {
    bandRefs.current[i][layer] = el;
  };

  return (
    <div className="race-view" ref={boxRef}>
      <svg
        ref={svgRef}
        className="race-svg"
        viewBox={`0 0 260 ${WORLD.h}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <Backdrop themeRef={setTheme} bandRef={setBand} />
        <Track measureRef={(el) => (measureRef.current = el)} roadRef={setRoad} />
        <Markers
          tickRef={(i) => (el) => (tickRefs.current[i] = el)}
          startRef={(el) => (startRef.current = el)}
          finishRef={(el) => (finishRef.current = el)}
        />

        {racers.map((r, i) => (
          <g key={r.id} ref={setNode(i, "root")}>
            <g ref={setNode(i, "spin")}>
              <g ref={setNode(i, "squash")}>
                <Car color={r.color} />
              </g>
            </g>
            {r.me && (
              <text
                y={-15} textAnchor="middle" fill="#e9eef1"
                fontSize={11} fontWeight={700}
                stroke="#0d1216" strokeWidth={2} paintOrder="stroke"
                fontFamily='"IBM Plex Sans KR", system-ui, sans-serif'
              >
                {r.name}
              </text>
            )}
          </g>
        ))}
      </svg>
      <canvas ref={canvasRef} className="race-fx" />
    </div>
  );
}
