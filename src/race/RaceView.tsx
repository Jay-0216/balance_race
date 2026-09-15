import { useEffect, useLayoutEffect, useRef } from "react";
import { Particles } from "./Particles";
import Backdrop, { PARALLAX_FACTORS, THEMES, mixColors, themeWeights } from "./Backdrop";
import { TICKS } from "./Markers";
import type { RaceEffect } from "./effects";
import Piece from "./Racer";
import { drawRoad } from "./RoadPainter";
import {
  CELL_LEN, chaseShot, mixShot, project, roadPoint, shotCam, topShot, topSpan,
} from "./cam3d";
import {
  CAR, CELLS, CRUISE, LANE_GAP, TRACK_CELLS, WORLD, type RacerView,
} from "./world";
import "./RaceView.css";

const MOVE_MS = 800;
/** the opening camera move, from behind the grid up to the overhead framing */
const INTRO_MS = 3000;
/** how much of it is spent sitting behind the car before the crane starts */
const INTRO_HOLD = 0.33;
const EASE = (k: number) => 1 - Math.pow(1 - k, 3);

type Tween = { from: number; to: number; t0: number };

type Node = {
  root: SVGGElement | null;
  spin: SVGGElement | null;
  squash: SVGGElement | null;
  plate: SVGGElement | null;
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
  const bgRef = useRef<SVGSVGElement>(null);
  const roadRef = useRef<HTMLCanvasElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<Node[]>([]);
  const themeRefs = useRef<(SVGGElement | null)[]>([]);
  const bandRefs = useRef<(SVGGElement | null)[][]>(THEMES.map(() => [null, null, null]));

  const fxRef = useRef(new Particles());
  const drawRef = useRef<number[]>(racers.map((r) => r.pos));
  /** last frame's drawn cell, jostle and cruise included - the real position */
  const prevRef = useRef<number[]>(racers.map((r) => r.pos));
  /** accumulated engine-bob phase, advanced faster the harder a car is pulling */
  const bobRef = useRef<number[]>(racers.map(() => 0));
  const lastTRef = useRef(0);
  const tweenRef = useRef<(Tween | null)[]>(racers.map(() => null));
  const racersRef = useRef(racers);
  /** smoothed camera centre, in cells - the camera lags the pack */
  const centreRef = useRef<number | null>(null);
  const zoomRef = useRef(1);

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
    const bg = bgRef.current;
    const road = roadRef.current;
    const svg = svgRef.current;
    const canvas = canvasRef.current;
    if (!box || !bg || !road || !svg || !canvas) return;

    const roadCtx = road.getContext("2d");
    const ctx = canvas.getContext("2d");
    if (!roadCtx || !ctx) return;

    const fx = fxRef.current;

    let px = 0, py = 0, dpr = 1;
    const resize = () => {
      const r = box.getBoundingClientRect();
      px = r.width; py = r.height;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      for (const c of [road, canvas]) {
        c.width = Math.max(1, Math.round(px * dpr));
        c.height = Math.max(1, Math.round(py * dpr));
      }
      roadCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // The car layer works in plain pixels: everything on it is placed by the
      // projection, which already returns pixels, and a viewBox in world units
      // would mean converting twice.
      svg.setAttribute("viewBox", `0 0 ${Math.max(1, px)} ${Math.max(1, py)}`);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(box);

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

      // Everything on the road - cars, distance ticks, the finish - is drawn at
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

      let lead = 0, last = Infinity, mine = 0;
      for (let i = 0; i < list.length; i++) {
        const d = drawRef.current[i] ?? 0;
        if (d > lead) lead = d;
        if (d < last) last = d;
        if (list[i].me) mine = d;
      }

      // Frame as much of the pack as is worth framing, then stop: by the end of
      // a race the spread can be the whole track, and fitting that would shrink
      // everyone to specks. Past the cap the tail drops off screen, which is
      // what the leaderboard is for.
      const span = topSpan(px, py);
      const spread = Math.abs(lead - last) * CELL_LEN;
      const zoomTarget = Math.max(1, Math.min(1.7, (spread * 1.6) / span));
      zoomRef.current += (zoomTarget - zoomRef.current) * (reduce ? 1 : 0.05);

      const focus = last + (lead - last) * 0.58 + cruise;
      if (centreRef.current === null || reduce) centreRef.current = focus;
      else centreRef.current += (focus - centreRef.current) * 0.08;
      const centre = centreRef.current;

      const intro = reduce ? 1 : Math.min(1, (now - t0) / INTRO_MS);
      const top = topShot(centre, px, py, zoomRef.current);
      let shot = top;
      if (intro < 1) {
        // The opening shot sits on the tarmac behind my own car, holds there
        // long enough to be a shot rather than a flicker, and only then cranes
        // out to the overhead framing the game is actually played in. Without
        // the hold the low angle is gone inside two frames and the whole move
        // reads as the picture glitching on the way in.
        const k = Math.max(0, (intro - INTRO_HOLD) / (1 - INTRO_HOLD));
        const rise = k * k * (3 - 2 * k);      // gentle at both ends
        const myLane = list.findIndex((r) => r.me);
        const lateral = (myLane < 0 ? 0 : myLane - (list.length - 1) / 2) * LANE_GAP;
        const seat = roadPoint(mine + cruise, lateral);
        shot = mixShot(chaseShot(mine + cruise, seat.x, px), top, rise);
      }
      const cam = shotCam(shot);

      // theme follows the leader: the backdrop IS the progress bar
      const weights = themeWeights(lead / CELLS);
      const colors = {
        edge: mixColors(THEMES.map((t) => t.road[0]), weights),
        surface: mixColors(THEMES.map((t) => t.road[1]), weights),
        dash: mixColors(THEMES.map((t) => t.road[2]), weights),
      };

      // The backdrop stays a flat layer behind the road, framed by the same
      // window the overhead camera sees, so it parallaxes exactly as it did.
      const vbW = span * zoomRef.current;
      const vbH = WORLD.h * zoomRef.current;
      const vbX = centre * CELL_LEN - vbW / 2;
      bg.setAttribute("viewBox", `${vbX} ${(WORLD.h - vbH) / 2} ${vbW} ${vbH}`);
      for (let t = 0; t < THEMES.length; t++) {
        const g = themeRefs.current[t];
        if (g) g.setAttribute("opacity", weights[t].toFixed(3));
        if (weights[t] <= 0) continue;
        for (let b = 0; b < 3; b++) {
          bandRefs.current[t][b]?.setAttribute(
            "transform",
            `translate(${vbX * (1 - factors[b])} 0)`
          );
        }
      }

      drawRoad(roadCtx, cam, px, py, {
        centre, cruise, colors, span: vbW, ticks: TICKS,
        ground: mixColors(THEMES.map((t) => t.bands[2]), weights),
      });

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
        const cell = d + cruise + jostle;
        const lateral = lane * LANE_GAP;

        const here = roadPoint(cell, lateral);
        const p = project(cam, here.x, here.y, here.z, px, py);
        // Heading comes from a second point a little further down the road:
        // on screen the road bends, and a car that ignored that would slide
        // along a bend pointing the wrong way.
        const nextPt = roadPoint(cell + 0.45, lateral);
        const q = project(cam, nextPt.x, nextPt.y, nextPt.z, px, py);
        const ang = Math.atan2(q.sy - p.sy, q.sx - p.sx);

        if (p.depth <= 0) {
          node.root.setAttribute("opacity", "0");
          continue;
        }
        node.root.setAttribute("opacity", "1");

        seats.set(list[i].id, { x: p.sx, y: p.sy, ang, cell, lateral });
        // Pixels, not world units: the piece art is drawn at world scale, so
        // the projection's own scale is exactly the factor it needs.
        node.root.setAttribute(
          "transform",
          `translate(${p.sx.toFixed(2)} ${p.sy.toFixed(2)}) scale(${p.scale.toFixed(4)})`
        );
        node.spin?.setAttribute("transform", `rotate(${(ang * 180) / Math.PI})`);

        // The plate is a label, not scenery: it undoes the camera's scale so it
        // stays the same size on screen wherever the car is. Left to scale with
        // the world it grows to fill the screen the moment the camera drops to
        // the tarmac. It also gets out of the way down there - a low shot is
        // the one moment the cars are meant to be looked at, not read.
        if (node.plate) {
          // 15px up: the same gap the plates used to sit at once the old
          // world-unit offset was multiplied out. Any further and they land on
          // the car in the next lane, which are only ~20px apart.
          node.plate.setAttribute(
            "transform",
            `translate(0 ${(-15 / p.scale).toFixed(2)}) scale(${(1 / p.scale).toFixed(4)})`
          );
          const shown = Math.max(0, Math.min(1, (cam.pitch - 0.55) / 0.5));
          node.plate.setAttribute("opacity", shown.toFixed(3));
        }

        // Speed is measured off the position actually drawn - jostle and
        // cruise included - not off the score, so a car surging past its
        // neighbour looks like it is surging.
        const prevCell = prevRef.current[i] ?? cell;
        prevRef.current[i] = cell;
        // Relative to the cruise everyone shares: 0 is holding station with
        // the pack, positive is pulling ahead, negative is dropping back.
        const vRel = dt > 0 ? (cell - prevCell) / dt - CRUISE : 0;

        // Signed and curved: a dash is ~3 cells/s and a jostle surge ~0.4, so
        // a linear map would leave the jostle invisible next to it.
        const k = Math.max(-1, Math.min(1, vRel / 3));
        const lean = Math.sign(k) * Math.pow(Math.abs(k), 0.6);
        const speed = Math.max(0, k);

        // A car stretching along its own length reads as motion blur. The bob
        // rides on top of the squash so a car at rest still looks like it is
        // running, and it revs: the harder a car is pulling, the faster it
        // shakes. Phase is accumulated rather than read off the clock, so
        // changing the rate never snaps the car sideways.
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
          const back = roadPoint(cell - (CAR.len * 0.6) / CELL_LEN, lateral);
          const pb = project(cam, back.x, back.y, back.z, px, py);
          if (pb.depth > 0) {
            // a trickle of dust even at rest, so nobody ever looks parked
            if (Math.random() < 0.07 + speed * 0.63) fx.dust(pb.sx, pb.sy, 1, "#6b7d89");
            if (speed > 0.35) {
              fx.trail(pb.sx, pb.sy, CAR.w * p.scale * 0.42, list[i].color);
            }
          }
          if (speed > 0.6 && Math.random() < 0.35) {
            fx.speedLine(p.sx, p.sy, list[i].color);
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
          // then a thinning tail.
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
          const age = (now - e.t0) / e.dur;
          const n = Math.round(2.1 * Math.pow(1 - age, 1.5));
          if (n <= 0) continue;
          fx.wind(seat.cell - 0.42, seat.lateral, n);
        }
      }

      if (!reduce) {
        fx.draw(ctx, px, py, (cell, lateral) => {
          const a = roadPoint(cell, lateral);
          const pa = project(cam, a.x, a.y, a.z, px, py);
          const b = roadPoint(cell + 0.3, lateral);
          const pb = project(cam, b.x, b.y, b.z, px, py);
          return {
            x: pa.sx,
            y: pa.sy,
            angle: Math.atan2(pb.sy - pa.sy, pb.sx - pa.sx),
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
    nodesRef.current[i] = nodesRef.current[i] ??
      { root: null, spin: null, squash: null, plate: null };
    nodesRef.current[i][k] = el;
  };

  const setTheme = (i: number) => (el: SVGGElement | null) => {
    themeRefs.current[i] = el;
  };

  const setBand = (i: number, layer: 0 | 1 | 2) => (el: SVGGElement | null) => {
    bandRefs.current[i][layer] = el;
  };

  return (
    <div className="race-view" ref={boxRef}>
      {/* Sky and hills stay a flat layer underneath: they are scenery, not
          geometry, and framing them with the same window the overhead camera
          uses keeps the parallax the game already had. */}
      <svg
        ref={bgRef}
        className="race-bg"
        viewBox={`0 0 260 ${WORLD.h}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <Backdrop themeRef={setTheme} bandRef={setBand} />
      </svg>

      <canvas ref={roadRef} className="race-road" />

      {/* The cars stay vector and stay on top: a sprite sheet would have to be
          re-rasterised every time the camera changes scale, and blowing up a
          bitmap is precisely what made the last attempt at depth go soft. */}
      <svg ref={svgRef} className="race-svg" aria-hidden="true">
        {racers.map((r, i) => (
          <g key={r.id} ref={setNode(i, "root")}>
            <g ref={setNode(i, "spin")}>
              <g ref={setNode(i, "squash")}>
                <Piece piece={r.piece} color={r.color} />
              </g>
            </g>
            {/* Everyone is named, not just me. Knowing that the car half a
                length ahead is 청개구리 is the whole reason to watch the pack -
                without it the race is eight anonymous dots and the standings
                below are the only thing worth reading. */}
            <g ref={setNode(i, "plate")}>
              <text
                textAnchor="middle"
                fill={r.me ? "#f2f6f8" : r.color}
                fontSize={r.me ? 12 : 9}
                fontWeight={600}
                opacity={r.me ? 1 : 0.92}
                stroke="#0b1015"
                strokeWidth={r.me ? 1.3 : 1.1}
                paintOrder="stroke"
                strokeLinejoin="round"
                fontFamily='"IBM Plex Sans KR", system-ui, sans-serif'
              >
                {r.name}
              </text>
            </g>
          </g>
        ))}
      </svg>

      <canvas ref={canvasRef} className="race-fx" />
    </div>
  );
}
