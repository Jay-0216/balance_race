import { CELLS, ROAD_W, TRACK_START, WORLD, buildTrackPath } from "./world";

const PATH = buildTrackPath();

/**
 * The road itself. The same path is drawn three times - edge, surface, centre
 * dashes - and a fourth invisible copy is the one the engine measures with
 * getPointAtLength, so geometry and rendering can never drift apart.
 */
export default function Track({
  measureRef,
  roadRef,
  tickPoints,
}: {
  measureRef: (el: SVGPathElement | null) => void;
  roadRef: (part: 0 | 1 | 2) => (el: SVGPathElement | null) => void;
  tickPoints: { x: number; y: number; cell: number; finish: boolean }[];
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

      <rect x={TRACK_START - 3} y={WORLD.h / 2 - ROAD_W / 2} width={2} height={ROAD_W} fill="#6d7f8b" />

      {tickPoints.map((t) =>
        t.finish ? (
          <g key={t.cell}>
            {Array.from({ length: 8 }, (_, r) => (
              <rect
                key={r}
                x={t.x - 5} y={t.y - ROAD_W / 2 + (r * ROAD_W) / 8}
                width={10} height={ROAD_W / 8}
                fill={r % 2 ? "#0e141a" : "#e9eef1"}
              />
            ))}
          </g>
        ) : (
          <g key={t.cell}>
            <rect x={t.x - 0.7} y={t.y - ROAD_W / 2} width={1.4} height={ROAD_W} fill="#4c5b66" />
            <text
              x={t.x} y={t.y - ROAD_W / 2 - 5} textAnchor="middle" fill="#71838f"
              fontSize={7.5} fontFamily="ui-monospace, monospace"
            >
              {t.cell}
            </text>
          </g>
        )
      )}
    </g>
  );
}

export { PATH, CELLS };
