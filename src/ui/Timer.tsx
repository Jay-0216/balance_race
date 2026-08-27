import { useEffect, useRef } from "react";
import "./Timer.css";

const R = 25;
const CIRC = 2 * Math.PI * R;

const CALM = "#3fb0ce";
const WARN = "#f0b429";
const RUSH = "#f4685b";

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
  const numRef = useRef<SVGTextElement>(null);
  const wrapRef = useRef<SVGGElement>(null);

  useEffect(() => {
    const arc = arcRef.current;
    const num = numRef.current;
    const wrap = wrapRef.current;
    if (!arc || !num || !wrap) return;

    if (locked) {
      arc.setAttribute("stroke-dashoffset", "0");
      arc.setAttribute("stroke", "#f0b429");
      num.setAttribute("fill", "#f0b429");
      num.textContent = "\u2713";     // a tick reads at any size; "잠금" did not
      wrap.classList.remove("beat");
      return;
    }

    let raf = 0;
    const tick = () => {
      const remain = running ? (endAt - performance.now()) / 1000 : limit;
      const frac = Math.max(0, Math.min(1, remain / limit));
      const color = ringColor(frac);
      arc.setAttribute("stroke-dashoffset", String(CIRC * (1 - frac)));
      arc.setAttribute("stroke", color);
      num.setAttribute("fill", color);
      num.textContent = remain > 0 ? remain.toFixed(1) : "0.0";
      wrap.classList.toggle("beat", running && remain <= 3 && remain > 0);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [endAt, limit, running, locked]);

  return (
    <div className="timer">
      <svg viewBox="0 0 84 84" aria-hidden="true">
        <g ref={wrapRef} className="timer-ring">
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
