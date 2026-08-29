import { CAR } from "./world";

/**
 * The things that go round the track.
 *
 * They are pieces, not cars. Nothing in the engine ever needed them to be
 * cars - it translates a group along the path, rotates it to the tangent and
 * squashes it along its own length - so a duck works exactly as well as an
 * F1 chassis, and a board-game piece is a friendlier idea than a livery.
 *
 * Every piece draws nose-first along +x with its centre at the origin, and
 * every one starts with the same ground shadow. That contract is the whole
 * reason a new piece is a single function here and no change anywhere else.
 */

const L = CAR.len / 2;      // 13.5
const W = CAR.w / 2;        // 6.75

/** The shadow every piece sits on. Same offset, so the field looks lit alike. */
function Shadow({ rx = L * 0.95, ry = W * 0.45 }: { rx?: number; ry?: number }) {
  return <ellipse cy={W * 1.15} rx={rx} ry={ry} fill="rgba(0,0,0,0.4)" />;
}

const INK = "#0d1216";
const DARK = "#12171c";

/* ---- the pieces --------------------------------------------------------- */

/** The original: a top-down formula car. */
function Racer({ color }: { color: string }) {
  return (
    <>
      <Shadow />
      <rect x={L * 0.82} y={-W * 0.95} width={2.6} height={W * 1.9} rx={1} fill="#1b232a" />
      <rect x={L * 0.78} y={-W * 0.34} width={3.4} height={W * 0.68} rx={0.8} fill="#141b21" />

      <rect x={-L * 0.7} y={-W - 1.6} width={L * 0.46} height={4} rx={1.4} fill={DARK} />
      <rect x={-L * 0.7} y={W - 2.4} width={L * 0.46} height={4} rx={1.4} fill={DARK} />
      <rect x={L * 0.26} y={-W - 1.2} width={L * 0.4} height={3.6} rx={1.3} fill={DARK} />
      <rect x={L * 0.26} y={W - 2.4} width={L * 0.4} height={3.6} rx={1.3} fill={DARK} />
      <rect x={-L * 0.63} y={-W - 1.1} width={L * 0.32} height={1} rx={0.5} fill="#38434c" />
      <rect x={-L * 0.63} y={W - 1.5} width={L * 0.32} height={1} rx={0.5} fill="#38434c" />

      <rect x={-L - 2} y={-W * 0.92} width={3.2} height={W * 1.84} rx={1.3} fill="#1b232a" />
      <rect x={-L - 2.4} y={-W * 1.02} width={4} height={2} rx={0.8} fill="#141b21" />
      <rect x={-L - 2.4} y={W * 0.82} width={4} height={2} rx={0.8} fill="#141b21" />

      <path
        d={`M ${-L} ${-W * 0.78} L ${-L * 0.2} ${-W} L ${L * 0.62} ${-W * 0.66}
            Q ${L} ${-W * 0.42} ${L} 0 Q ${L} ${W * 0.42} ${L * 0.62} ${W * 0.66}
            L ${-L * 0.2} ${W} L ${-L} ${W * 0.78} Z`}
        fill={color} stroke={INK} strokeWidth={1.6} strokeLinejoin="round"
      />
      <rect x={-L * 0.34} y={-W * 0.99} width={L * 0.62} height={2.1} rx={1} fill="rgba(13,18,22,0.4)" />
      <rect x={-L * 0.34} y={W * 0.99 - 2.1} width={L * 0.62} height={2.1} rx={1} fill="rgba(13,18,22,0.4)" />
      <path
        d={`M ${-L * 0.86} ${-W * 0.34} L ${-L * 0.06} ${-W * 0.46}
            L ${-L * 0.06} ${W * 0.46} L ${-L * 0.86} ${W * 0.34} Z`}
        fill="rgba(255,255,255,0.13)"
      />
      <ellipse cx={-L * 0.12} rx={L * 0.28} ry={W * 0.54} fill="#141b21" opacity={0.9} />
      <circle cx={-L * 0.12} r={W * 0.3} fill="#9fadb8" />
      <rect x={-L * 0.12 + W * 0.04} y={-W * 0.22} width={W * 0.26} height={W * 0.44}
        rx={W * 0.1} fill="#1d2831" />
      <rect x={L * 0.2} y={-W * 0.13} width={L * 0.52} height={W * 0.26} rx={0.7}
        fill="#ffffff" opacity={0.26} />
      <rect x={-L * 0.99} y={-W * 0.18} width={1.3} height={W * 0.36} rx={0.6}
        fill="#ff5a4a" opacity={0.6} />
    </>
  );
}

function Truck({ color }: { color: string }) {
  return (
    <>
      <Shadow />
      {/* six wheels, because that is what says truck from above */}
      {[-L * 0.72, -L * 0.42, L * 0.42].map((x, i) => (
        <g key={i}>
          <rect x={x} y={-W - 1.5} width={L * 0.26} height={3.8} rx={1.3} fill={DARK} />
          <rect x={x} y={W - 2.3} width={L * 0.26} height={3.8} rx={1.3} fill={DARK} />
        </g>
      ))}
      {/* the bed, open and darker than the cab */}
      <rect x={-L} y={-W * 0.92} width={L * 1.28} height={W * 1.84} rx={2}
        fill={color} stroke={INK} strokeWidth={1.5} />
      <rect x={-L * 0.9} y={-W * 0.66} width={L * 1.08} height={W * 1.32} rx={1.4}
        fill="rgba(0,0,0,0.42)" />
      {/* the cab */}
      <rect x={L * 0.3} y={-W * 0.86} width={L * 0.68} height={W * 1.72} rx={3}
        fill={color} stroke={INK} strokeWidth={1.5} />
      <rect x={L * 0.44} y={-W * 0.6} width={L * 0.34} height={W * 1.2} rx={1.6}
        fill="#9fc4d8" opacity={0.75} />
      <rect x={L * 0.2} y={-W * 0.9} width={2} height={W * 1.8} rx={1} fill="#141b21" />
    </>
  );
}

function Bus({ color }: { color: string }) {
  return (
    <>
      <Shadow />
      {[-L * 0.66, L * 0.36].map((x, i) => (
        <g key={i}>
          <rect x={x} y={-W - 1.3} width={L * 0.28} height={3.4} rx={1.2} fill={DARK} />
          <rect x={x} y={W - 2.1} width={L * 0.28} height={3.4} rx={1.2} fill={DARK} />
        </g>
      ))}
      <rect x={-L} y={-W * 0.94} width={L * 2} height={W * 1.88} rx={4.5}
        fill={color} stroke={INK} strokeWidth={1.6} />
      {/* a row of windows down each side - the giveaway that it carries people */}
      {[-0.62, -0.28, 0.06, 0.4].map((f, i) => (
        <g key={i}>
          <rect x={L * f} y={-W * 0.86} width={L * 0.26} height={1.9} rx={0.8}
            fill="#9fc4d8" opacity={0.7} />
          <rect x={L * f} y={W * 0.86 - 1.9} width={L * 0.26} height={1.9} rx={0.8}
            fill="#9fc4d8" opacity={0.7} />
        </g>
      ))}
      <rect x={L * 0.8} y={-W * 0.62} width={L * 0.16} height={W * 1.24} rx={1.4}
        fill="#9fc4d8" opacity={0.8} />
      <rect x={-L * 0.96} y={-W * 0.3} width={1.4} height={W * 0.6} rx={0.6} fill="#ff5a4a" opacity={0.7} />
    </>
  );
}

function Duck({ color }: { color: string }) {
  return (
    <>
      <Shadow rx={L * 0.8} />
      {/* tail */}
      <path d={`M ${-L} 0 L ${-L * 0.5} ${-W * 0.6} L ${-L * 0.5} ${W * 0.6} Z`}
        fill={color} stroke={INK} strokeWidth={1.2} strokeLinejoin="round" />
      {/* body */}
      <ellipse cx={-L * 0.12} rx={L * 0.74} ry={W * 0.94} fill={color}
        stroke={INK} strokeWidth={1.5} />
      {/* folded wings */}
      <ellipse cx={-L * 0.16} cy={-W * 0.5} rx={L * 0.42} ry={W * 0.3}
        fill="rgba(255,255,255,0.22)" />
      <ellipse cx={-L * 0.16} cy={W * 0.5} rx={L * 0.42} ry={W * 0.3}
        fill="rgba(0,0,0,0.16)" />
      {/* head and bill, out front where the nose belongs */}
      <circle cx={L * 0.62} r={W * 0.62} fill={color} stroke={INK} strokeWidth={1.4} />
      <path d={`M ${L * 0.96} ${-W * 0.26} L ${L * 1.32} 0 L ${L * 0.96} ${W * 0.26} Z`}
        fill="#f2a33c" stroke={INK} strokeWidth={0.9} strokeLinejoin="round" />
      <circle cx={L * 0.66} cy={-W * 0.34} r={0.9} fill={INK} />
      <circle cx={L * 0.66} cy={W * 0.34} r={0.9} fill={INK} />
    </>
  );
}

function Cat({ color }: { color: string }) {
  return (
    <>
      <Shadow rx={L * 0.82} />
      {/* tail, curling off the back */}
      <path d={`M ${-L * 0.72} 0 Q ${-L * 1.3} ${-W * 0.2} ${-L * 1.1} ${-W * 1.0}`}
        fill="none" stroke={color} strokeWidth={2.6} strokeLinecap="round" />
      <ellipse cx={-L * 0.1} rx={L * 0.7} ry={W * 0.86} fill={color}
        stroke={INK} strokeWidth={1.5} />
      {/* paws */}
      {[-1, 1].map((s) => (
        <g key={s}>
          <ellipse cx={L * 0.34} cy={s * W * 0.82} rx={2.1} ry={1.5} fill={color} stroke={INK} strokeWidth={0.9} />
          <ellipse cx={-L * 0.44} cy={s * W * 0.86} rx={2.1} ry={1.5} fill={color} stroke={INK} strokeWidth={0.9} />
        </g>
      ))}
      {/* head with ears */}
      <path d={`M ${L * 0.5} ${-W * 0.62} L ${L * 0.62} ${-W * 0.98} L ${L * 0.8} ${-W * 0.5} Z`}
        fill={color} stroke={INK} strokeWidth={1} strokeLinejoin="round" />
      <path d={`M ${L * 0.5} ${W * 0.62} L ${L * 0.62} ${W * 0.98} L ${L * 0.8} ${W * 0.5} Z`}
        fill={color} stroke={INK} strokeWidth={1} strokeLinejoin="round" />
      <circle cx={L * 0.66} r={W * 0.62} fill={color} stroke={INK} strokeWidth={1.4} />
      <circle cx={L * 0.74} cy={-W * 0.3} r={0.95} fill={INK} />
      <circle cx={L * 0.74} cy={W * 0.3} r={0.95} fill={INK} />
      <path d={`M ${L * 0.98} 0 l 1.6 0`} stroke={INK} strokeWidth={0.8} strokeLinecap="round" />
    </>
  );
}

function Turtle({ color }: { color: string }) {
  return (
    <>
      <Shadow rx={L * 0.8} />
      {/* flippers first, so the shell sits on top of them */}
      {[[-0.5, -1], [-0.5, 1], [0.34, -1], [0.34, 1]].map(([fx, s], i) => (
        <ellipse key={i} cx={L * (fx as number)} cy={(s as number) * W * 0.82}
          rx={2.6} ry={1.7} fill="#8fbf9c" stroke={INK} strokeWidth={0.9}
          transform={`rotate(${(s as number) * 24} ${L * (fx as number)} ${(s as number) * W * 0.82})`} />
      ))}
      <ellipse cx={L * 0.82} rx={W * 0.5} ry={W * 0.42} fill="#8fbf9c" stroke={INK} strokeWidth={1} />
      <circle cx={L * 0.92} cy={-W * 0.22} r={0.8} fill={INK} />
      <circle cx={L * 0.92} cy={W * 0.22} r={0.8} fill={INK} />
      <path d={`M ${-L * 0.96} 0 l -2 0`} stroke="#8fbf9c" strokeWidth={2} strokeLinecap="round" />
      {/* shell: a hexagon with plates, which is what reads as a turtle */}
      <path
        d={`M ${L * 0.56} 0 L ${L * 0.3} ${-W * 0.9} L ${-L * 0.34} ${-W * 0.9}
            L ${-L * 0.66} 0 L ${-L * 0.34} ${W * 0.9} L ${L * 0.3} ${W * 0.9} Z`}
        fill={color} stroke={INK} strokeWidth={1.5} strokeLinejoin="round"
      />
      <path
        d={`M ${L * 0.2} 0 L ${L * 0.02} ${-W * 0.44} L ${-L * 0.3} ${-W * 0.44}
            L ${-L * 0.42} 0 L ${-L * 0.3} ${W * 0.44} L ${L * 0.02} ${W * 0.44} Z`}
        fill="rgba(0,0,0,0.22)"
      />
    </>
  );
}

function Rocket({ color }: { color: string }) {
  return (
    <>
      <Shadow rx={L * 0.9} />
      {/* fins */}
      <path d={`M ${-L * 0.42} ${-W * 0.6} L ${-L * 1.05} ${-W * 1.15} L ${-L * 0.62} ${-W * 0.2} Z`}
        fill="#d8623f" stroke={INK} strokeWidth={1} strokeLinejoin="round" />
      <path d={`M ${-L * 0.42} ${W * 0.6} L ${-L * 1.05} ${W * 1.15} L ${-L * 0.62} ${W * 0.2} Z`}
        fill="#d8623f" stroke={INK} strokeWidth={1} strokeLinejoin="round" />
      {/* body, nose to nozzle */}
      <path
        d={`M ${L} 0 Q ${L * 0.5} ${-W * 0.92} ${-L * 0.5} ${-W * 0.86}
            L ${-L * 0.92} ${-W * 0.62} L ${-L * 0.92} ${W * 0.62}
            L ${-L * 0.5} ${W * 0.86} Q ${L * 0.5} ${W * 0.92} ${L} 0 Z`}
        fill={color} stroke={INK} strokeWidth={1.6} strokeLinejoin="round"
      />
      <path d={`M ${L} 0 Q ${L * 0.62} ${-W * 0.5} ${L * 0.36} ${-W * 0.62}
                L ${L * 0.36} ${W * 0.62} Q ${L * 0.62} ${W * 0.5} ${L} 0 Z`}
        fill="#e8eef2" opacity={0.85} />
      <circle cx={-L * 0.1} r={W * 0.4} fill="#3fb0ce" stroke={INK} strokeWidth={1} />
      <rect x={-L * 1.02} y={-W * 0.5} width={2.4} height={W} rx={1} fill="#141b21" />
    </>
  );
}

function Pencil({ color }: { color: string }) {
  return (
    <>
      <Shadow rx={L * 0.92} ry={W * 0.34} />
      {/* the tip is the nose */}
      <path d={`M ${L} 0 L ${L * 0.6} ${-W * 0.52} L ${L * 0.6} ${W * 0.52} Z`}
        fill="#3a2a1c" stroke={INK} strokeWidth={0.9} strokeLinejoin="round" />
      <path d={`M ${L * 0.72} 0 L ${L * 0.6} ${-W * 0.16} L ${L * 0.6} ${W * 0.16} Z`} fill="#e8eef2" />
      <rect x={L * 0.34} y={-W * 0.56} width={L * 0.28} height={W * 1.12} rx={1} fill="#e3c58a" stroke={INK} strokeWidth={0.9} />
      <rect x={-L * 0.66} y={-W * 0.58} width={L * 1.02} height={W * 1.16} rx={1.4}
        fill={color} stroke={INK} strokeWidth={1.4} />
      <rect x={-L * 0.66} y={-W * 0.58} width={L * 1.02} height={W * 0.3} fill="rgba(255,255,255,0.2)" />
      {/* ferrule and eraser at the back */}
      <rect x={-L * 0.86} y={-W * 0.6} width={L * 0.22} height={W * 1.2} rx={1} fill="#b8c2c9" stroke={INK} strokeWidth={0.9} />
      <rect x={-L} y={-W * 0.54} width={L * 0.18} height={W * 1.08} rx={2} fill="#f28d9c" stroke={INK} strokeWidth={0.9} />
    </>
  );
}

function Ufo({ color }: { color: string }) {
  return (
    <>
      <Shadow rx={L * 0.98} ry={W * 0.5} />
      {/* the beam, so it reads as hovering rather than parked */}
      <path d={`M ${-L * 0.3} ${W * 0.3} L ${-L * 0.75} ${W * 1.5} L ${L * 0.75} ${W * 1.5} L ${L * 0.3} ${W * 0.3} Z`}
        fill="#7fe3d0" opacity={0.16} />
      <ellipse rx={L * 0.98} ry={W * 0.6} fill={color} stroke={INK} strokeWidth={1.6} />
      <ellipse ry={W * 0.24} rx={L * 0.9} fill="rgba(255,255,255,0.18)" />
      {/* lights around the rim */}
      {[-0.66, -0.22, 0.22, 0.66].map((f, i) => (
        <circle key={i} cx={L * f} cy={W * 0.34} r={1.15} fill="#ffe08a" />
      ))}
      <ellipse cx={L * 0.06} cy={-W * 0.18} rx={L * 0.42} ry={W * 0.5} fill="#8fd8ea" stroke={INK} strokeWidth={1.2} opacity={0.92} />
      <ellipse cx={L * 0.18} cy={-W * 0.32} rx={L * 0.14} ry={W * 0.16} fill="#ffffff" opacity={0.6} />
    </>
  );
}

/* ---- the catalogue ------------------------------------------------------ */

export const PIECE_ART = {
  racer: Racer,
  truck: Truck,
  bus: Bus,
  duck: Duck,
  cat: Cat,
  turtle: Turtle,
  rocket: Rocket,
  pencil: Pencil,
  ufo: Ufo,
} as const;

export type PieceId = keyof typeof PIECE_ART;

export const DEFAULT_PIECE: PieceId = "racer";

export function isPieceId(v: unknown): v is PieceId {
  return typeof v === "string" && v in PIECE_ART;
}
