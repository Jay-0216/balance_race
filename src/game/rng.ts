/**
 * A seeded random number generator.
 *
 * Online, "random" has to mean "the same random for everyone". Bot choices and
 * the choice made for someone who ran out of clock are both random, and both
 * have to come out identical on every phone in the room - otherwise two people
 * watching the same race see different cars move.
 *
 * mulberry32: 32 bits of state, one multiply and a couple of shifts, and a
 * period long enough that a twelve-round game never approaches it. The point
 * is not statistical excellence, it is that everyone agrees.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a, so a room code and a round number become a seed everyone shares. */
export function seedOf(...parts: (string | number)[]): number {
  let h = 0x811c9dc5;
  const s = parts.join(":");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export const rngFor = (...parts: (string | number)[]) => mulberry32(seedOf(...parts));
