import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Camera } from "./Camera";
import { Particles } from "./Particles";
import Backdrop, {
  PARALLAX_FACTORS, THEMES, mixColors, themeWeights, tileWidth,
} from "./Backdrop";
import Car from "./Racer";
import Track from "./Track";
import { CAR, CELLS, CRUISE, LANE_GAP, LANE_STAGGER, WORLD, type RacerView } from "./world";
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
  onFps,
}: {
  racers: RacerView[];
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

  const [ticks, setTicks] = useState<
    { x: number; y: number; cell: number; finish: boolean }[]
  >([]);

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
    const usable = len - 6;

    const at = (cells: number) => {
      const l = Math.max(0, Math.min(1, cells / CELLS)) * usable;
      const p = measure.getPointAtLength(l);
      const q = measure.getPointAtLength(Math.min(len, l + 1));
      return { x: p.x, y: p.y, ang: Math.atan2(q.y - p.y, q.x - p.x) };
    };

    setTicks(
      Array.from({ length: Math.floor(CELLS / 5) }, (_, i) => {
        const cell = (i + 1) * 5;
        const p = at(cell);
        return { x: p.x, y: p.y, cell, finish: cell === CELLS };
      })
    );

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
    const tiles = THEMES.map((t) => [0, 1, 2].map((l) => tileWidth(t.style, l as 0 | 1 | 2)));

    let raf = 0;
    let frames = 0;
    let fpsAt = performance.now();
    const t0 = performance.now();

    const frame = (now: number) => {
      const list = racersRef.current;

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
      const leadPt = at(lead);
      const lastPt = at(last);
      cam.update(leadPt.x, lastPt.x, !reduce);

      const vb = cam.viewBox().split(" ").map(Number);
      vbX = vb[0]; vbY = vb[1]; vbW = vb[2]; vbH = vb[3];
      svg.setAttribute("viewBox", cam.viewBox());

      const camX = cam.x;
      // The cars are always driving, whatever the round decided: the world
      // treadmills past them. Cell positions - the score - never move for it.
      const cruise = reduce ? 0 : ((now - t0) / 1000) * CRUISE;
      // theme follows the leader: the backdrop IS the progress bar
      const weights = themeWeights(lead / CELLS);
      for (let part = 0; part < 3; part++) {
        roadRefs.current[part]?.setAttribute(
          "stroke",
          mixColors(THEMES.map((t) => t.road[part]), weights)
        );
      }
      // the centre line runs backwards under the cars - the cheapest and
      // strongest "we are moving" cue there is
      roadRefs.current[2]?.setAttribute("stroke-dashoffset", String(cruise % 25));
      for (let t = 0; t < THEMES.length; t++) {
        const g = themeRefs.current[t];
        if (g) g.setAttribute("opacity", weights[t].toFixed(3));
        if (weights[t] <= 0) continue;
        for (let b = 0; b < 3; b++) {
          const drift = (cruise * factors[b]) % tiles[t][b];
          bandRefs.current[t][b]?.setAttribute(
            "transform",
            `translate(${camX * (1 - factors[b]) - drift} 0)`
          );
        }
      }

      for (let i = 0; i < list.length; i++) {
        const node = nodesRef.current[i];
        if (!node?.root) continue;

        const d = drawRef.current[i] ?? 0;
        const lane = i - (list.length - 1) / 2;
        const p = at(d);
        const nx = -Math.sin(p.ang), ny = Math.cos(p.ang);
        const stagger = (i % 2 === 0 ? 1 : -1) * LANE_STAGGER;
        const wx = p.x + nx * lane * LANE_GAP + Math.cos(p.ang) * stagger;
        const wy = p.y + ny * lane * LANE_GAP + Math.sin(p.ang) * stagger;

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

      if (!reduce) fx.draw(ctx, px, py);

      frames++;
      if (now - fpsAt >= 500) {
        onFps?.(Math.round((frames * 1000) / (now - fpsAt)));
        frames = 0;
        fpsAt = now;
      }

      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [reduce, onFps]);

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
        <Track
          measureRef={(el) => (measureRef.current = el)}
          roadRef={setRoad}
          tickPoints={ticks}
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
