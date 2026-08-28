import { CAR } from "./world";

/**
 * Top-down race car, drawn nose-first along +x so the engine's rotate() puts
 * it along the track. Local origin is the centre of the chassis.
 *
 * The proportions are the mockup's, not a re-derivation: half-length 13.5 is
 * what makes the wheels, the wing and the nose highlight survive at phone
 * size. The detail sizes below are absolute on purpose - a wheel 4 units tall
 * reads as a wheel, and scaling it with the chassis would lose it again.
 *
 * Nothing here animates. The whole car is one static group that the engine
 * translates, rotates and squashes, so extra detail costs a one-off node and
 * nothing per frame.
 */
export default function Car({ color }: { color: string }) {
  const L = CAR.len / 2;
  const W = CAR.w / 2;

  return (
    <>
      <ellipse cy={W * 1.15} rx={L * 0.95} ry={W * 0.45} fill="rgba(0,0,0,0.4)" />

      {/* front wing, ahead of the nose */}
      <rect x={L * 0.82} y={-W * 0.95} width={2.6} height={W * 1.9} rx={1} fill="#1b232a" />
      <rect x={L * 0.78} y={-W * 0.34} width={3.4} height={W * 0.68} rx={0.8} fill="#141b21" />

      {/* wheels sit proud of the chassis on both axles */}
      <rect x={-L * 0.7} y={-W - 1.6} width={L * 0.46} height={4} rx={1.4} fill="#12171c" />
      <rect x={-L * 0.7} y={W - 2.4} width={L * 0.46} height={4} rx={1.4} fill="#12171c" />
      <rect x={L * 0.26} y={-W - 1.2} width={L * 0.4} height={3.6} rx={1.3} fill="#12171c" />
      <rect x={L * 0.26} y={W - 2.4} width={L * 0.4} height={3.6} rx={1.3} fill="#12171c" />
      {/* a rim highlight, so a wheel is a wheel and not a black smudge */}
      <rect x={-L * 0.63} y={-W - 1.1} width={L * 0.32} height={1} rx={0.5} fill="#38434c" />
      <rect x={-L * 0.63} y={W - 1.5} width={L * 0.32} height={1} rx={0.5} fill="#38434c" />

      {/* rear wing, with endplates */}
      <rect x={-L - 2} y={-W * 0.92} width={3.2} height={W * 1.84} rx={1.3} fill="#1b232a" />
      <rect x={-L - 2.4} y={-W * 1.02} width={4} height={2} rx={0.8} fill="#141b21" />
      <rect x={-L - 2.4} y={W * 0.82} width={4} height={2} rx={0.8} fill="#141b21" />

      {/* chassis: wide at the rear, tapering to the nose */}
      <path
        d={`M ${-L} ${-W * 0.78}
            L ${-L * 0.2} ${-W}
            L ${L * 0.62} ${-W * 0.66}
            Q ${L} ${-W * 0.42} ${L} 0
            Q ${L} ${W * 0.42} ${L * 0.62} ${W * 0.66}
            L ${-L * 0.2} ${W}
            L ${-L} ${W * 0.78} Z`}
        fill={color}
        stroke="#0d1216"
        strokeWidth={1.6}
        strokeLinejoin="round"
      />

      {/* side pods between the axles - the widest part of a real car */}
      <rect x={-L * 0.34} y={-W * 0.99} width={L * 0.62} height={2.1} rx={1} fill="rgba(13,18,22,0.4)" />
      <rect x={-L * 0.34} y={W * 0.99 - 2.1} width={L * 0.62} height={2.1} rx={1} fill="rgba(13,18,22,0.4)" />

      {/* engine cover down the spine, behind the driver */}
      <path
        d={`M ${-L * 0.86} ${-W * 0.34} L ${-L * 0.06} ${-W * 0.46}
            L ${-L * 0.06} ${W * 0.46} L ${-L * 0.86} ${W * 0.34} Z`}
        fill="rgba(255,255,255,0.13)"
      />

      {/* cockpit surround, then the driver's helmet inside it. The helmet is
          grey and small on purpose - a big white disc with a dark centre
          stopped reading as a helmet and started reading as an eye. */}
      <ellipse cx={-L * 0.12} rx={L * 0.28} ry={W * 0.54} fill="#141b21" opacity={0.9} />
      <circle cx={-L * 0.12} r={W * 0.3} fill="#9fadb8" />
      {/* visor: a dark band across the forward half */}
      <rect
        x={-L * 0.12 + W * 0.04} y={-W * 0.22} width={W * 0.26} height={W * 0.44}
        rx={W * 0.1} fill="#1d2831"
      />

      {/* nose highlight so the car still reads at phone size */}
      <rect
        x={L * 0.2} y={-W * 0.13} width={L * 0.52} height={W * 0.26}
        rx={0.7} fill="#ffffff" opacity={0.26}
      />
      {/* tail light */}
      <rect x={-L * 0.99} y={-W * 0.18} width={1.3} height={W * 0.36} rx={0.6} fill="#ff5a4a" opacity={0.6} />
    </>
  );
}
