import { useEffect, useRef } from "react";
import "./TallyBar.css";

/**
 * Counts up from zero so the reveal is read rather than just appearing.
 * The number is written straight to the DOM: a setState per frame re-rendered
 * the whole panel sixty times a second right in the middle of the dash, which
 * is exactly when the frame budget is tightest.
 */
function useCountUp(target: number, run: boolean, ms = 520) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!run) { el.textContent = ""; return; }

    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / ms);
      const n = Math.round(target * (1 - Math.pow(1 - k, 3)));
      el.textContent = n > 0 ? String(n) : "";
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, run, ms]);

  return ref;
}

export default function TallyBar({
  countA,
  countB,
  show,
}: {
  countA: number;
  countB: number;
  show: boolean;
}) {
  const total = Math.max(1, countA + countB);
  const aRef = useCountUp(countA, show);
  const bRef = useCountUp(countB, show);

  return (
    <div className={"tally" + (show ? " on" : "")}>
      <div className="tally-bar">
        <div className="tally-seg a" style={{ width: show ? `${(countA / total) * 100}%` : 0 }}>
          <span ref={aRef} />
        </div>
        <div className="tally-seg b" style={{ width: show ? `${(countB / total) * 100}%` : 0 }}>
          <span ref={bRef} />
        </div>
      </div>
    </div>
  );
}
