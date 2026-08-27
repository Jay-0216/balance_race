import { ROAD_W, buildTrackPath } from "./world";

const PATH = buildTrackPath();

/**
 * The road itself, and nothing that moves along it. The same path is drawn
 * three times - edge, surface, centre dashes - and a fourth invisible copy is
 * the one the engine measures with getPointAtLength, so geometry and rendering
 * can never drift apart.
 */
export default function Track({
  measureRef,
  roadRef,
}: {
  measureRef: (el: SVGPathElement | null) => void;
  roadRef: (part: 0 | 1 | 2) => (el: SVGPathElement | null) => void;
}) {
  return (
    <g>
      <path ref={roadRef(0)} d={PATH} fill="none" stroke="#4a5a65" strokeWidth={ROAD_W + 7} strokeLinecap="round" />
      <path ref={roadRef(1)} d={PATH} fill="none" stroke="#333f49" strokeWidth={ROAD_W} strokeLinecap="round" />
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
