import { CAR } from "./world";
import type { PieceId } from "./pieces";

/**
 * The same nine things, seen from behind.
 *
 * The top-down art cannot be reused for this: from a camera down on the tarmac
 * a flat overhead drawing reads as a sticker lying on the road, which is
 * exactly what the first pass looked like. These are billboards - drawn
 * standing up, wheels on the ground at y = 0, body rising into -y - and the
 * race view cross-fades to them as the camera drops.
 *
 * Same contract as the flat set: world units, centred on x = 0, one colour in.
 */

const W = CAR.w / 2;          // 6.75
const INK = "#0d1216";
const DARK = "#141b21";
const GLASS = "#20303c";

/** Everything sits on one, so nothing floats once the camera is low. */
function Ground({ rx = W * 1.5 }: { rx?: number }) {
  return <ellipse cy={0} rx={rx} ry={W * 0.3} fill="rgba(0,0,0,0.42)" />;
}

/** The two rear tyres most of these ride on. */
function Tyres({ y = -3.4, r = 3.6, out = W * 1.32 }: { y?: number; r?: number; out?: number }) {
  return (
    <>
      <rect x={-out - r * 0.7} y={y - r} width={r * 1.4} height={r * 2} rx={1.5} fill={DARK} />
      <rect x={out - r * 0.7} y={y - r} width={r * 1.4} height={r * 2} rx={1.5} fill={DARK} />
    </>
  );
}

/** A pair of tail lights, the one cue that reads as "back" at any size. */
function Lights({ y, out = W * 0.62, w = 2.2, h = 1.5 }: {
  y: number; out?: number; w?: number; h?: number;
}) {
  return (
    <>
      <rect x={-out - w / 2} y={y} width={w} height={h} rx={0.6} fill="#e8553f" />
      <rect x={out - w / 2} y={y} width={w} height={h} rx={0.6} fill="#e8553f" />
    </>
  );
}

function RacerRear({ color }: { color: string }) {
  return (
    <>
      <Ground />
      <Tyres y={-3.6} r={3.8} out={W * 1.3} />
      {/* diffuser under the gearbox */}
      <rect x={-W * 0.8} y={-2.4} width={W * 1.6} height={2.4} rx={0.6} fill={INK} />
      {/* body, narrowing upward the way a rear crash structure does */}
      <path
        d={`M ${-W * 0.92} -2.6 L ${W * 0.92} -2.6 L ${W * 0.6} -8.4 L ${-W * 0.6} -8.4 Z`}
        fill={color}
      />
      <rect x={-W * 0.34} y={-9.6} width={W * 0.68} height={1.6} rx={0.5} fill={DARK} />
      <Lights y={-5.2} out={W * 0.66} />
      {/* Rear wing: two end plates and a plane, the shape everyone knows. Kept
          inside the lane gap - at full width the eight wings on a starting
          grid merge into one long bar across the road. */}
      <rect x={-W * 1.14} y={-13.6} width={W * 2.28} height={1.5} rx={0.5} fill={color} />
      <rect x={-W * 1.14} y={-13.6} width={1.3} height={4.4} rx={0.5} fill={INK} />
      <rect x={W * 1.14 - 1.3} y={-13.6} width={1.3} height={4.4} rx={0.5} fill={INK} />
      <rect x={-W * 1.06} y={-12.1} width={W * 2.12} height={0.7} fill="rgba(255,255,255,0.18)" />
    </>
  );
}

function TruckRear({ color }: { color: string }) {
  return (
    <>
      <Ground rx={W * 1.7} />
      <Tyres y={-2.8} r={3} out={W * 1.28} />
      <rect x={-W * 1.35} y={-14} width={W * 2.7} height={11.6} rx={1.2} fill={color} />
      {/* the two door halves, and the seam between them */}
      <rect x={-W * 1.2} y={-12.8} width={W * 2.4} height={8.6} rx={0.8} fill="rgba(0,0,0,0.16)" />
      <rect x={-0.35} y={-12.8} width={0.7} height={8.6} fill={INK} />
      <Lights y={-3.6} out={W * 1.05} w={2.6} h={1.8} />
      <rect x={-W * 1.35} y={-2.6} width={W * 2.7} height={1.2} rx={0.4} fill={INK} />
    </>
  );
}

function BusRear({ color }: { color: string }) {
  return (
    <>
      <Ground rx={W * 1.7} />
      <Tyres y={-2.6} r={2.8} out={W * 1.24} />
      <rect x={-W * 1.32} y={-16} width={W * 2.64} height={13.6} rx={2} fill={color} />
      <rect x={-W * 1.05} y={-14.6} width={W * 2.1} height={5.6} rx={1.2} fill={GLASS} />
      <rect x={-W * 1.05} y={-14.6} width={W * 2.1} height={1.8} rx={1.2} fill="rgba(255,255,255,0.12)" />
      <Lights y={-5.4} out={W * 1} w={2.4} h={2.2} />
      <rect x={-W * 1.32} y={-2.8} width={W * 2.64} height={1.4} rx={0.4} fill={INK} />
    </>
  );
}

function DuckRear({ color }: { color: string }) {
  return (
    <>
      <Ground rx={W * 1.3} />
      {/* webbed feet poking out the back */}
      <path d={`M ${-W * 0.9} -0.3 l -2.6 1 l 2.6 0.6 z`} fill="#e8a33c" />
      <path d={`M ${W * 0.9} -0.3 l 2.6 1 l -2.6 0.6 z`} fill="#e8a33c" />
      <ellipse cx={0} cy={-5.4} rx={W * 1.25} ry={5.6} fill={color} />
      {/* tail feathers, flicked up */}
      <path d={`M 0 -9.6 q 2.6 -3.4 5.4 -3.2 q -2 2.6 -3.4 4.6 z`} fill={color} />
      <ellipse cx={0} cy={-11.4} rx={W * 0.62} ry={3.2} fill={color} />
      <ellipse cx={0} cy={-6.2} rx={W * 0.78} ry={3.4} fill="rgba(255,255,255,0.14)" />
      <Lights y={-4} out={W * 0.5} w={1.6} h={1.2} />
    </>
  );
}

function CatRear({ color }: { color: string }) {
  return (
    <>
      <Ground rx={W * 1.25} />
      <ellipse cx={0} cy={-5} rx={W * 1.2} ry={5.2} fill={color} />
      {/* tail up, the only thing a cat from behind ever really is */}
      <path
        d="M 1.2 -8 q 4.6 -1.4 4.2 -6.4 q -0.2 -2.6 -2 -3"
        stroke={color} strokeWidth={2.4} fill="none" strokeLinecap="round"
      />
      <ellipse cx={-W * 0.62} cy={-1.1} rx={2} ry={1.3} fill={DARK} />
      <ellipse cx={W * 0.62} cy={-1.1} rx={2} ry={1.3} fill={DARK} />
      {/* ears just clearing the top of the head */}
      <path d={`M ${-W * 0.7} -9.6 l 1.5 -2.6 l 1.6 2 z`} fill={color} />
      <path d={`M ${W * 0.7} -9.6 l -1.5 -2.6 l -1.6 2 z`} fill={color} />
      <ellipse cx={0} cy={-9.2} rx={W * 0.86} ry={2.8} fill={color} />
    </>
  );
}

function TurtleRear({ color }: { color: string }) {
  return (
    <>
      <Ground rx={W * 1.5} />
      <path d={`M ${-W * 1.4} -1 l 2 1.2 l 2 -1.2 z`} fill="#c9b184" />
      <path d={`M ${W * 1.4} -1 l -2 1.2 l -2 -1.2 z`} fill="#c9b184" />
      <path
        d={`M ${-W * 1.45} -1 a ${W * 1.45} 8.6 0 0 1 ${W * 2.9} 0 z`}
        fill={color}
      />
      <path
        d={`M ${-W * 0.8} -1 a ${W * 0.8} 5 0 0 1 ${W * 1.6} 0 z`}
        fill="rgba(0,0,0,0.16)"
      />
      <rect x={-W * 1.45} y={-1.6} width={W * 2.9} height={1.6} rx={0.6} fill="#c9b184" />
      <path d={`M 0 -1.8 l -1.4 -3.4 l 2.8 0 z`} fill="rgba(255,255,255,0.14)" />
    </>
  );
}

function RocketRear({ color }: { color: string }) {
  return (
    <>
      <Ground rx={W * 1.2} />
      {/* fins first, so the body sits over them */}
      <path d={`M ${-W * 0.7} -3 l ${-W * 1.1} 3 l 0 -5 z`} fill="#c0563f" />
      <path d={`M ${W * 0.7} -3 l ${W * 1.1} 3 l 0 -5 z`} fill="#c0563f" />
      <rect x={-W * 0.78} y={-13.6} width={W * 1.56} height={11.4} rx={2.2} fill={color} />
      <rect x={-W * 0.78} y={-9} width={W * 1.56} height={1.4} fill="rgba(0,0,0,0.18)" />
      {/* nozzle, and the flame that says which end this is */}
      <path d={`M ${-W * 0.62} -2.4 l ${W * 1.24} 0 l ${W * 0.28} 2.4 l ${-W * 1.8} 0 z`} fill={DARK} />
      <path d={`M 0 0.6 l -2.4 -2.2 l 2.4 -1.2 l 2.4 1.2 z`} fill="#ffb74a" />
      <path d={`M 0 -0.2 l -1.2 -1.4 l 1.2 -0.8 l 1.2 0.8 z`} fill="#fff0c2" />
    </>
  );
}

function PencilRear({ color }: { color: string }) {
  return (
    <>
      <Ground rx={W * 1.1} />
      {/* the flat end of a hexagonal barrel: three visible facets */}
      <rect x={-W * 0.86} y={-12.6} width={W * 1.72} height={10.6} fill={color} />
      <rect x={-W * 0.86} y={-12.6} width={W * 0.5} height={10.6} fill="rgba(0,0,0,0.18)" />
      <rect x={W * 0.36} y={-12.6} width={W * 0.5} height={10.6} fill="rgba(255,255,255,0.14)" />
      {/* ferrule and eraser */}
      <rect x={-W * 0.9} y={-14.8} width={W * 1.8} height={2.4} rx={0.4} fill="#b9c2c9" />
      <rect x={-W * 0.9} y={-13.8} width={W * 1.8} height={0.6} fill="rgba(0,0,0,0.2)" />
      <rect x={-W * 0.82} y={-17.2} width={W * 1.64} height={2.6} rx={1} fill="#e79aa4" />
      <rect x={-W * 0.86} y={-2.4} width={W * 1.72} height={1.4} rx={0.4} fill={INK} />
    </>
  );
}

function UfoRear({ color }: { color: string }) {
  return (
    <>
      <Ground rx={W * 1.9} />
      {/* a saucer is the same from every angle, so the read is the underglow */}
      <ellipse cx={0} cy={-8.6} rx={W * 1.05} ry={3.4} fill={GLASS} />
      <ellipse cx={0} cy={-9.4} rx={W * 0.78} ry={2.4} fill="rgba(255,255,255,0.22)" />
      <ellipse cx={0} cy={-6.4} rx={W * 1.9} ry={2.8} fill={color} />
      <ellipse cx={0} cy={-7.2} rx={W * 1.9} ry={2.4} fill="rgba(255,255,255,0.12)" />
      <ellipse cx={0} cy={-4.6} rx={W * 1.15} ry={1.5} fill="#8ce0d6" opacity={0.75} />
      <ellipse cx={0} cy={-1.6} rx={W * 1.5} ry={1.6} fill="#8ce0d6" opacity={0.18} />
      <circle cx={-W * 1.3} cy={-5.8} r={0.8} fill="#ffe08a" />
      <circle cx={W * 1.3} cy={-5.8} r={0.8} fill="#ffe08a" />
    </>
  );
}

export const PIECE_REAR: Record<PieceId, (p: { color: string }) => JSX.Element> = {
  racer: RacerRear,
  truck: TruckRear,
  bus: BusRear,
  duck: DuckRear,
  cat: CatRear,
  turtle: TurtleRear,
  rocket: RocketRear,
  pencil: PencilRear,
  ufo: UfoRear,
};
