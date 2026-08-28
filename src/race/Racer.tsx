import { CAR } from "./world";

/**
 * Top-down race car, drawn nose-first along +x so the engine's rotate() puts
 * it along the track. Local origin is the centre of the chassis.
 *
 * The proportions are the mockup's, not a re-derivation: half-length 13.5 is
 * what makes the wheels, the wing and the nose highlight survive at phone
 * size. The detail sizes below are absolute on purpose - a wheel 4 units tall
 * reads as a wheel, and scaling it with the chassis would lose it again.
 */
export default function Car({ color }: { color: string }) {
  const L = CAR.len / 2;
  const W = CAR.w / 2;

  return (
    <>
      <ellipse cy={W * 1.15} rx={L * 0.95} ry={W * 0.45} fill="rgba(0,0,0,0.4)" />

      {/* wheels sit proud of the chassis on both axles */}
      <rect x={-L * 0.7} y={-W - 1.6} width={L * 0.46} height={4} rx={1.4} fill="#12171c" />
      <rect x={-L * 0.7} y={W - 2.4} width={L * 0.46} height={4} rx={1.4} fill="#12171c" />
      <rect x={L * 0.26} y={-W - 1.2} width={L * 0.4} height={3.6} rx={1.3} fill="#12171c" />
      <rect x={L * 0.26} y={W - 2.4} width={L * 0.4} height={3.6} rx={1.3} fill="#12171c" />

      {/* rear wing */}
      <rect x={-L - 2} y={-W * 0.92} width={3.2} height={W * 1.84} rx={1.3} fill="#1b232a" />

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

      {/* cockpit + a highlight down the nose so the car reads at phone size */}
      <ellipse cx={-L * 0.12} rx={L * 0.26} ry={W * 0.5} fill="#141b21" opacity={0.85} />
      <rect
        x={L * 0.18} y={-W * 0.14} width={L * 0.6} height={W * 0.28}
        rx={0.8} fill="#ffffff" opacity={0.22}
      />
    </>
  );
}
