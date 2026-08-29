import { equippedPiece, myPaint } from "../game/garage";
import Piece from "../race/Racer";
import "./TrackPreview.css";

const RACERS = [
  { c: "#f0b429", me: true },
  { c: "#9aa9b4" }, { c: "#7fb89a" }, { c: "#b79acb" }, { c: "#c9a47e" },
  { c: "#7fa3c9" }, { c: "#c98fa6" }, { c: "#a5b87f" },
];

/**
 * Title-screen ambience: the game's own track, with everyone still parked at
 * the start line. Not gameplay - it just stops the frame reading as empty.
 *
 * The others stay dots. Only mine is the real piece, so a trip to the garage
 * shows up on the first screen you see rather than only once a race starts.
 */
export default function TrackPreview() {
  const piece = equippedPiece();
  const paint = myPaint();

  return (
    <div className="tp" aria-hidden="true">
      <svg viewBox="0 0 300 220" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="tpFade" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#2c373f" stopOpacity="1" />
            <stop offset="0.75" stopColor="#2c373f" stopOpacity="0.35" />
            <stop offset="1" stopColor="#2c373f" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="tpDash" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#4a5b66" stopOpacity="0.9" />
            <stop offset="0.7" stopColor="#4a5b66" stopOpacity="0" />
          </linearGradient>
        </defs>

        <path
          d="M 26 150 C 90 150 96 74 160 74 S 240 132 300 122"
          fill="none" stroke="url(#tpFade)" strokeWidth="46" strokeLinecap="round"
        />
        <path
          d="M 26 150 C 90 150 96 74 160 74 S 240 132 300 122"
          fill="none" stroke="url(#tpDash)" strokeWidth="1.5"
          strokeDasharray="7 11" strokeLinecap="round"
        />

        {RACERS.map((r, i) =>
          r.me ? (
            // Two groups, not one. The bob is a CSS animation on `transform`,
            // and a CSS transform beats an SVG transform *attribute* - so a
            // single group had its position overwritten by the bob and my
            // piece floated off on its own, away from the grid.
            <g key={i} transform={`translate(30 ${132 + i * 5.2}) scale(0.62)`}>
              <g className="tp-racer tp-me" style={{ animationDelay: `${i * 0.14}s` }}>
                <Piece piece={piece} color={paint} />
              </g>
            </g>
          ) : (
            <circle
              key={i}
              className="tp-racer"
              cx={30}
              cy={132 + i * 5.2}
              r={4.6}
              fill={r.c}
              stroke="#11171c"
              strokeWidth="1.6"
              style={{ animationDelay: `${i * 0.14}s` }}
            />
          )
        )}
      </svg>
    </div>
  );
}
