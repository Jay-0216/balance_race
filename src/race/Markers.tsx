import { CELLS, ROAD_W } from "./world";

/**
 * Distance ticks and the finish line. These ride the cruise exactly like the
 * cars do - the finish is drawn at (20 + cruise) cells, so it stays exactly 20
 * cells ahead of the start and the leader still meets it at 20. The engine
 * repositions them every frame, so they are refs, not static geometry.
 */
export const TICKS = Array.from({ length: Math.floor(CELLS / 5) }, (_, i) => (i + 1) * 5);

export default function Markers({
  tickRef,
  startRef,
  finishRef,
}: {
  tickRef: (i: number) => (el: SVGGElement | null) => void;
  startRef: (el: SVGGElement | null) => void;
  finishRef: (el: SVGGElement | null) => void;
}) {
  return (
    <g>
      <g ref={startRef}>
        <rect x={-1} y={-ROAD_W / 2} width={2} height={ROAD_W} fill="#6d7f8b" />
      </g>
      {TICKS.filter((c) => c < CELLS).map((cell, i) => (
        <g key={cell} ref={tickRef(i)}>
          <rect x={-0.7} y={-ROAD_W / 2} width={1.4} height={ROAD_W} fill="#4c5b66" />
          <text
            x={0} y={-ROAD_W / 2 - 5} textAnchor="middle" fill="#71838f"
            fontSize={7.5} fontFamily="ui-monospace, monospace"
          >
            {cell}
          </text>
        </g>
      ))}

      <g ref={finishRef}>
        {Array.from({ length: 8 }, (_, r) => (
          <rect
            key={r}
            x={-5} y={-ROAD_W / 2 + (r * ROAD_W) / 8}
            width={10} height={ROAD_W / 8}
            fill={r % 2 ? "#0e141a" : "#e9eef1"}
          />
        ))}
      </g>
    </g>
  );
}
