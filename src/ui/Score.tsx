import { useEffect, useRef, useState } from "react";
import "./Score.css";

/**
 * My score, as a number.
 *
 * The standings underneath already carry every player's cell count, but that
 * is a table you read - it answers "who is winning", not "what did that round
 * just do to me". So this is one number, on the track, big, with the change
 * flying off it the moment it happens.
 */
export default function Score({ pos, cells }: { pos: number; cells: number }) {
  const prev = useRef(pos);
  const [delta, setDelta] = useState<{ n: number; at: number } | null>(null);

  useEffect(() => {
    const d = pos - prev.current;
    prev.current = pos;
    if (d === 0) return;
    setDelta({ n: d, at: performance.now() });
    const id = window.setTimeout(() => setDelta(null), 1400);
    return () => clearTimeout(id);
  }, [pos]);

  return (
    <div className="score">
      <span className="score-label">내 점수</span>
      <span className="score-now">
        {/* keyed on the value so the number itself takes the hit, not just
            the badge floating away from it */}
        <b key={pos}>{pos}</b>
        <i>/{cells}</i>
      </span>
      {delta && (
        <span key={delta.at} className={"score-delta" + (delta.n > 0 ? " up" : " down")}>
          {delta.n > 0 ? "+" : "−"}{Math.abs(delta.n)}
        </span>
      )}
    </div>
  );
}
