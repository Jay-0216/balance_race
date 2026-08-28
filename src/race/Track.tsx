import { ROAD_W, buildTrackPath } from "./world";

const PATH = buildTrackPath();

/**
 * The road itself, and nothing that moves along it. The same path is drawn
 * several times - kerbs, edge, surface, centre dashes - and a final invisible
 * copy is the one the engine measures with getPointAtLength, so geometry and
 * rendering can never drift apart.
 *
 * The kerbs are the same path stroked wide in white and then again in red with
 * a dash pattern offset by half a period, which alternates the two colours
 * along both edges at once. Drawing them as real geometry would mean hundreds
 * of little quads that all have to bend with the road.
 */
export default function Track({
  measureRef,
  roadRef,
}: {
  measureRef: (el: SVGPathElement | null) => void;
  roadRef: (part: 0 | 1 | 2) => (el: SVGPathElement | null) => void;
}) {
  const KERB = ROAD_W + 15;
  return (
    <g>
      <path d={PATH} fill="none" stroke="#d8dee2" strokeWidth={KERB} strokeLinecap="round" />
      <path
        d={PATH} fill="none" stroke="#c8564a" strokeWidth={KERB}
        strokeDasharray="13 13" strokeDashoffset={13}
      />
      <path ref={roadRef(0)} d={PATH} fill="none" stroke="#4a5a65" strokeWidth={ROAD_W + 7} strokeLinecap="round" />
      <path ref={roadRef(1)} d={PATH} fill="none" stroke="#333f49" strokeWidth={ROAD_W} strokeLinecap="round" />
      {/* a soft sheen down the middle so a wide road is not a flat slab */}
      <path
        d={PATH} fill="none" stroke="#ffffff" strokeWidth={ROAD_W * 0.55}
        strokeLinecap="round" opacity={0.045}
      />
      <path
        ref={roadRef(2)}
        d={PATH} fill="none" stroke="#5f7079" strokeWidth={1.6}
        strokeDasharray="10 15" strokeLinecap="round"
      />
      <path ref={measureRef} d={PATH} fill="none" stroke="none" />
    </g>
  );
}

export { PATH };
