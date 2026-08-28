/**
 * Pen marks, drawn on.
 *
 * Everything here draws itself with stroke-dashoffset and `pathLength={100}`.
 * Normalising the length in the attribute is what makes that possible without
 * measuring anything in JS: the dash array is 100 whatever the real path
 * length is, so a circle and an arrow can share one keyframe.
 */

/**
 * A circle drawn by hand, not a perfect one. It overshoots past its own start
 * the way a pen does, and the radius wobbles - a geometric ellipse reads as a
 * UI element that was always there, and this has to read as something being
 * drawn onto the picture right now.
 */
function ringPath(cx: number, cy: number, rx: number, ry: number, seed: number) {
  const steps = 56;
  const start = -1.9;
  const sweep = Math.PI * 2 * 1.07;       // past the start, like a real loop
  let d = "";
  for (let i = 0; i <= steps; i++) {
    const a = start + sweep * (i / steps);
    const w = 1 + Math.sin(a * 3 + seed) * 0.035 + Math.sin(a * 5 + seed * 2.3) * 0.022;
    const x = cx + Math.cos(a) * rx * w;
    const y = cy + Math.sin(a) * ry * w;
    d += (i ? " L " : "M ") + x.toFixed(1) + " " + y.toFixed(1);
  }
  return d;
}

export function Ring({
  cx, cy, rx, ry, delay = 0, color = "var(--gold)", seed = 1, width = 2.4,
}: {
  cx: number; cy: number; rx: number; ry: number;
  delay?: number; color?: string; seed?: number; width?: number;
}) {
  return (
    <path
      className="sc-draw"
      d={ringPath(cx, cy, rx, ry, seed)}
      pathLength={100}
      style={{ animationDelay: `${delay}s`, stroke: color, strokeWidth: width }}
    />
  );
}

/** A pointer, with the head drawn as part of the same stroke. */
export function Arrow({
  x1, y1, x2, y2, delay = 0, color = "var(--gold)", bend = 0,
}: {
  x1: number; y1: number; x2: number; y2: number;
  delay?: number; color?: string; /** sideways curve, in units */ bend?: number;
}) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const ang = Math.atan2(y2 - y1, x2 - x1);
  // the control point is pushed perpendicular to the line, so bend curves it
  const cx = mx - Math.sin(ang) * bend;
  const cy = my + Math.cos(ang) * bend;
  const head = 6;
  const hx = (k: number) => x2 - Math.cos(ang + k) * head;
  const hy = (k: number) => y2 - Math.sin(ang + k) * head;
  return (
    <path
      className="sc-draw"
      d={`M ${x1} ${y1} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${x2} ${y2}
          M ${hx(0.5).toFixed(1)} ${hy(0.5).toFixed(1)} L ${x2} ${y2}
          L ${hx(-0.5).toFixed(1)} ${hy(-0.5).toFixed(1)}`}
      pathLength={100}
      style={{ animationDelay: `${delay}s`, stroke: color }}
    />
  );
}

/** An underline with a kink in it, for a word that matters. */
export function Underline({
  x, y, w, delay = 0, color = "var(--gold)",
}: {
  x: number; y: number; w: number; delay?: number; color?: string;
}) {
  return (
    <path
      className="sc-draw"
      d={`M ${x} ${y} Q ${x + w * 0.3} ${y + 3} ${x + w * 0.55} ${y + 1}
          T ${x + w} ${y + 2}`}
      pathLength={100}
      style={{ animationDelay: `${delay}s`, stroke: color }}
    />
  );
}

/**
 * Text that writes itself, one character at a time.
 *
 * A per-character stagger rather than a typewriter that mutates the string:
 * the whole sentence is in the DOM from the first frame, so a screen reader
 * and a text search both get it in one piece while the eye still sees it
 * being written.
 */
export function Written({
  text, delay = 0, className = "",
}: {
  text: string; delay?: number; className?: string;
}) {
  return (
    <span className={"sc-wr " + className}>
      {[...text].map((ch, i) => (
        <span key={i} style={{ animationDelay: `${(delay + i * 0.024).toFixed(3)}s` }}>
          {ch === " " ? " " : ch}
        </span>
      ))}
    </span>
  );
}
