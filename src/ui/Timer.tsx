import { useEffect, useRef } from "react";
import "./Timer.css";

const R = 25;
const CIRC = 2 * Math.PI * R;

const CALM = "#3fb0ce";
const WARN = "#f0b429";
const RUSH = "#f4685b";

/** the last N seconds are the ones that panic */
const PANIC_FROM = 4;

function mix(c1: string, c2: string, t: number) {
  const ch = (c: string, i: number) => parseInt(c.substr(1 + i * 2, 2), 16);
  let out = "#";
  for (let i = 0; i < 3; i++) {
    const v = Math.round(ch(c1, i) + (ch(c2, i) - ch(c1, i)) * t);
    out += v.toString(16).padStart(2, "0");
  }
  return out;
}

/** cyan while there is time, amber as it tightens, coral when it is gone */
export function ringColor(frac: number) {
  if (frac > 0.5) return CALM;
  if (frac > 0.3) return mix(WARN, CALM, (frac - 0.3) / 0.2);
  return mix(RUSH, WARN, Math.pow(frac / 0.3, 2));
}

/**
 * The countdown is the round's pressure made visible, so it runs on
 * performance.now() through rAF rather than setInterval: a backgrounded tab
 * must not be able to drift one player's deadline away from everyone else's.
 *
 * The panic is driven here rather than by a CSS animation. A CSS keyframe can
 * only be switched on at a threshold, so the ring used to beat at one fixed
 * rate for the whole last three seconds - the same at 3.0s as at 0.2s. Rate,
 * depth and glow now all ramp continuously as the clock closes, which is the
 * difference between "time is short" and "time is nearly gone".
 */
export default function Timer({
  endAt,
  limit,
  running,
  locked,
}: {
  endAt: number;
  limit: number;
  running: boolean;
  /** the player has committed - the ring freezes gold */
  locked: boolean;
}) {
  const arcRef = useRef<SVGCircleElement>(null);
  const glowRef = useRef<SVGCircleElement>(null);
  const numRef = useRef<SVGTextElement>(null);
  const wrapRef = useRef<SVGGElement>(null);

  useEffect(() => {
    const arc = arcRef.current;
    const glow = glowRef.current;
    const num = numRef.current;
    const wrap = wrapRef.current;
    if (!arc || !glow || !num || !wrap) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const rest = () => {
      wrap.style.transform = "";
      glow.setAttribute("opacity", "0");
      arc.setAttribute("stroke-width", "4");
    };

    if (locked) {
      arc.setAttribute("stroke-dashoffset", "0");
      arc.setAttribute("stroke", WARN);
      num.setAttribute("fill", WARN);
      num.textContent = "✓";     // a tick reads at any size; "잠금" did not
      rest();
      return;
    }

    let raf = 0;
    let phase = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      const remain = running ? (endAt - performance.now()) / 1000 : limit;
      const frac = Math.max(0, Math.min(1, remain / limit));
      const color = ringColor(frac);
      arc.setAttribute("stroke-dashoffset", String(CIRC * (1 - frac)));
      arc.setAttribute("stroke", color);
      num.setAttribute("fill", color);
      num.textContent = remain > 0 ? remain.toFixed(1) : "0.0";

      // 0 while there is time, 1 at the buzzer. Squared so the last second
      // is where most of the panic lives rather than spreading it evenly.
      const urgency =
        !running || remain > PANIC_FROM || remain <= 0
          ? 0
          : Math.pow(1 - remain / PANIC_FROM, 2);

      if (reduce || urgency <= 0) {
        rest();
      } else {
        // 1.0Hz at four seconds out, ~4.6Hz at the buzzer
        phase += dt * (6.3 + urgency * 22);
        const beat = Math.sin(phase) * 0.5 + 0.5;          // 0..1
        wrap.style.transform = `scale(${1 + beat * (0.05 + urgency * 0.13)})`;
        glow.setAttribute("opacity", (beat * urgency * 0.85).toFixed(3));
        glow.setAttribute("stroke", color);
        arc.setAttribute("stroke-width", (4 + beat * urgency * 2.4).toFixed(2));
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      rest();
    };
  }, [endAt, limit, running, locked]);

  return (
    <div className="timer">
      <svg viewBox="0 0 84 84" aria-hidden="true">
        <g ref={wrapRef} className="timer-ring">
          {/* the flash: a wide soft ring behind the arc, pulsed from the loop */}
          <circle
            ref={glowRef} cx="42" cy="42" r={R} fill="none" stroke={RUSH}
            strokeWidth="11" opacity="0" className="timer-glow"
          />
          <circle cx="42" cy="42" r={R} fill="rgba(17,23,28,.72)" stroke="#2c373f" strokeWidth="4" />
          <circle
            ref={arcRef} cx="42" cy="42" r={R} fill="none" stroke={CALM} strokeWidth="4"
            strokeLinecap="round" strokeDasharray={CIRC} transform="rotate(-90 42 42)"
          />
          <text
            ref={numRef} x="42" y="48" textAnchor="middle" fill="#e9eef1"
            fontFamily="ui-monospace, monospace" fontSize="17" fontWeight="600"
          >
            {limit}
          </text>
        </g>
      </svg>
    </div>
  );
}
