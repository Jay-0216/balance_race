import { WORLD } from "./world";

/**
 * Three background bands. A layer at factor f should appear to move at f x the
 * camera's speed; since the camera moves the viewBox, each layer counter-
 * translates by camX * (1 - f). The refs are written by the engine every
 * frame - React never re-renders these.
 */
export type ParallaxRefs = {
  far: SVGGElement | null;
  mid: SVGGElement | null;
  near: SVGGElement | null;
};

export const PARALLAX_FACTORS = { far: 0.2, mid: 0.5, near: 1.2 };

const SPAN = WORLD.w + 900;
const ORIGIN = -450;

/**
 * Each band closes well below the world floor. The camera zooms out to frame a
 * spread pack, which shows world-space beyond WORLD.h - if the fill stopped at
 * the floor, the sky gradient showed through underneath as a bright seam.
 */
const FLOOR = WORLD.h + 400;

function hills(baseY: number, amp: number, stepX: number) {
  let d = `M ${ORIGIN} ${FLOOR}`;
  d += ` L ${ORIGIN} ${baseY}`;
  for (let x = ORIGIN; x < ORIGIN + SPAN; x += stepX) {
    const peak = baseY - amp * (0.6 + (((x - ORIGIN) / stepX) % 3) * 0.2);
    d += ` Q ${x + stepX / 2} ${peak} ${x + stepX} ${baseY}`;
  }
  d += ` L ${ORIGIN + SPAN} ${FLOOR} Z`;
  return d;
}

export default function Parallax({
  refs,
}: {
  refs: (k: keyof ParallaxRefs) => (el: SVGGElement | null) => void;
}) {
  return (
    <>
      <g ref={refs("far")}>
        <path d={hills(112, 74, 190)} fill="#141d25" />
      </g>
      <g ref={refs("mid")}>
        <path d={hills(154, 44, 118)} fill="#1a2630" />
      </g>
      <g ref={refs("near")}>
        <path d={hills(WORLD.h + 4, 16, 64)} fill="#0d1317" opacity="0.95" />
      </g>
    </>
  );
}
