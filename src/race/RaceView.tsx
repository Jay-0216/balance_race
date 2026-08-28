import { useEffect, useLayoutEffect, useRef } from "react";
import { Camera } from "./Camera";
import { Particles } from "./Particles";
import Backdrop, { PARALLAX_FACTORS, THEMES, mixColors, themeWeights } from "./Backdrop";
import Markers, { TICKS } from "./Markers";
import type { RaceEffect } from "./effects";
import Car from "./Racer";
import Track from "./Track";
import {
  CAR, CELLS, CRUISE, LANE_GAP, LEAD_CELLS, TRACK_CELLS, WORLD,
  type RacerView,
} from "./world";
import "./RaceView.css";

const MOVE_MS = 800;
/** the opening camera move, from behind the grid up to the overhead framing */
const INTRO_MS = 2100;
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
  /** last frame's drawn cell, jostle and cruise included - the real position */
  const prevRef = useRef<number[]>(racers.map((r) => r.pos));
  /** accumulated engine-bob phase, advanced faster the harder a car is pulling */
  const bobRef = useRef<number[]>(racers.map(() => 0));
  const lastTRef = useRef(0);
  const tweenRef = useRef<(Tween | null)[]>(racers.map(() => null));
  const racersRef = useRef(racers);

  const tickRefs = useRef<(SVGGElement | null)[]>([]);
  const startRef = useRef<SVGGElement | null>(null);
  const finishRef = useRef<SVGGElement | null>(null);
  const activeFx = useRef<
    { playerId: number; kind: RaceEffect["kind"]; t0: number; dur: number }[]
  >([]);
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
        t0: now,
        // Both end with the dash (MOVE_MS). A gust that outlives the movement
        // reads as the car still accelerating after it has stopped.
        dur: e.kind === "booster" ? MOVE_MS + 120 : MOVE_MS - 80,
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
      // Velocity has to be per second, not per frame: a 144Hz laptop would
      // otherwise read every car as moving a third as fast as a 60Hz phone.
      const dt = Math.min(0.05, (now - (lastTRef.current || now)) / 1000);
      lastTRef.current = now;

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
      const intro = reduce ? 1 : Math.min(1, (now - t0) / INTRO_MS);
      cam.update(leadPt.x, lastPt.x, !reduce, intro);

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
        // The pack is never a rigid formation: every car runs its own little
        // engine and they trade a third of a car length back and forth the
        // whole way down the road. The phase of the fast wave is warped by a
        // sine of itself, so the lunge forward is short and the drift back is
        // long - it is the *derivative* the eye reads as speed, and a plain
        // sine hums along at a near-constant one.
        const th = now / (620 + i * 47) + i * 2.1;
        const jostle = reduce
          ? 0
          : Math.sin(th + 0.55 * Math.sin(th)) * 0.2 +
            Math.sin(now / (1130 + i * 83) + i) * 0.1;
        const p = at(d + cruise + jostle);
        const nx = -Math.sin(p.ang), ny = Math.cos(p.ang);
        // No along-track stagger. It was there to keep neighbouring lanes
        // apart, but the lane gap does that on its own now, and zig-zagging
        // every other car broke the clean diagonal the pack makes on a bend.
        const wx = p.x + nx * lane * LANE_GAP;
        const wy = p.y + ny * lane * LANE_GAP;

        seats.set(list[i].id, {
          x: sx(wx), y: sy(wy), ang: p.ang,
          cell: d + cruise + jostle, lateral: lane * LANE_GAP,
        });
        node.root.setAttribute("transform", `translate(${wx} ${wy})`);
        node.spin?.setAttribute("transform", `rotate(${(p.ang * 180) / Math.PI})`);

        // Speed is measured off the position actually drawn - jostle and
        // cruise included - not off the score, so a car surging past its
        // neighbour looks like it is surging. Reading the score alone left
        // every car in the jostle at a dead-constant speed.
        const cellNow = d + cruise + jostle;
        const prevCell = prevRef.current[i] ?? cellNow;
        prevRef.current[i] = cellNow;
        // Relative to the cruise everyone shares: 0 is holding station with
        // the pack, positive is pulling ahead, negative is dropping back.
        const vRel = dt > 0 ? (cellNow - prevCell) / dt - CRUISE : 0;

        // Signed and curved: a dash is ~3 cells/s and a jostle surge ~0.4, so
        // a linear map would leave the jostle invisible next to it. The 0.55
        // power lifts the small end without letting it reach the dash.
        const k = Math.max(-1, Math.min(1, vRel / 3));
        const lean = Math.sign(k) * Math.pow(Math.abs(k), 0.6);
        // Unsigned and linear - the particle thresholds below want the old
        // scale, where only a real round-advance blooms into a trail.
        const speed = Math.max(0, k);

        // A car stretching along its own length reads as motion blur, so this
        // can be pushed much further than it could on a circle. Falling back
        // compresses it, which reads as lifting off.
        // The bob rides on top of the squash so a car at rest still looks
        // like it is running, and it revs: the harder a car is pulling, the
        // faster it shakes. Phase is accumulated rather than read off the
        // clock, so changing the rate never snaps the car sideways.
        if (!reduce && node.squash) {
          bobRef.current[i] =
            (bobRef.current[i] ?? 0) + dt * Math.max(2.5, 7.4 + lean * 9);
          const bob = Math.sin(bobRef.current[i] + i * 1.7) * (0.4 + Math.abs(lean) * 0.5);
          node.squash.setAttribute(
            "transform",
            `translate(0 ${bob}) scale(${1 + lean * 0.62} ${1 - lean * 0.28})`
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
        activeFx.current = activeFx.current.filter((e) => now - e.t0 < e.dur);
        // boosters first: they must never be starved of pool slots by the
        // gusts firing in the same frame
        for (const e of activeFx.current) {
          if (e.kind !== "booster") continue;
          const seat = seats.get(e.playerId);
          if (!seat) continue;
          // A flare, not a jet: everything at once for the first few frames,
          // then a thinning tail. Emitting a flat 12 per frame for the whole
          // duration was ~470 particles alive off one car.
          const age = (now - e.t0) / e.dur;
          const n = age < 0.07 ? 11 : Math.round(4 * Math.pow(1 - age, 1.6));
          if (n <= 0) continue;
          fx.flame(
            seat.x - Math.cos(seat.ang) * CAR.len * 0.55,
            seat.y - Math.sin(seat.ang) * CAR.len * 0.55,
            seat.ang, n
          );
        }
        for (const e of activeFx.current) {
          if (e.kind !== "advance") continue;
          const seat = seats.get(e.playerId);
          if (!seat) continue;
          // Front-loaded too. A constant 3 per car per frame with seven cars
          // gusting was more than the whole pool could hold, so the wind kept
          // cutting out and coming back as slots freed.
          const age = (now - e.t0) / e.dur;
          const n = Math.round(2.1 * Math.pow(1 - age, 1.5));
          if (n <= 0) continue;
          fx.wind(seat.cell - 0.42, seat.lateral, n);
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
            {/* Everyone is named, not just me. Knowing that the car half a
                length ahead is 청개구리 is the whole reason to watch the pack -
                without it the race is eight anonymous dots and the standings
                below are the only thing worth reading.

                A rival's plate is tinted with its own car colour and set
                small; mine is white, bigger and heavier, so my car is still
                the one the eye finds first. The heavy dark stroke is what
                keeps a plate legible where it overlaps the next lane's
                wheels - at this lane gap it always will. */}
            <text
              y={r.me ? -14 : -11}
              textAnchor="middle"
              fill={r.me ? "#f2f6f8" : r.color}
              fontSize={r.me ? 10.5 : 7.6}
              fontWeight={r.me ? 700 : 600}
              opacity={r.me ? 1 : 0.92}
              stroke="#0b1015"
              strokeWidth={r.me ? 2.2 : 1.9}
              paintOrder="stroke"
              strokeLinejoin="round"
              fontFamily='"IBM Plex Sans KR", system-ui, sans-serif'
            >
              {r.name}
            </text>
          </g>
        ))}
      </svg>
      <canvas ref={canvasRef} className="race-fx" />
    </div>
  );
}
