/**
 * A short buzz at the moments that already have a sound.
 *
 * The plan called this out and it is right: a dash you feel lands differently
 * from a dash you only see. It also matters for the case this game is actually
 * played in - a phone on silent, under a desk - where vibration is the only
 * feedback left.
 *
 * navigator.vibrate is Android's; iOS Safari ignores it entirely and always
 * has. That is fine and is why nothing here reports failure: this is a garnish
 * on top of the sound, never the only signal for anything.
 */
export type Buzz = "pick" | "reveal" | "dash" | "booster" | "miss" | "alert" | "finish";

const KEY = "ddr.buzz";

/** ms on/off pairs. Kept short - a long buzz reads as an error, not a hit. */
const PATTERN: Record<Buzz, number | number[]> = {
  pick: 10,
  reveal: [0, 18, 40, 26],
  dash: 22,
  booster: [0, 30, 26, 55],
  miss: 12,
  alert: [0, 40, 55, 40, 55, 75],
  finish: [0, 55, 45, 55, 45, 110],
};

let on = read();

function read() {
  try {
    return localStorage.getItem(KEY) !== "0";
  } catch {
    return true;
  }
}

export function buzzOn() {
  return on;
}

export function setBuzz(next: boolean) {
  on = next;
  try {
    localStorage.setItem(KEY, next ? "1" : "0");
  } catch {
    // a private window just means the choice does not survive a reload
  }
  if (next) buzz("pick");        // confirm the setting with the thing itself
}

/** True where this can do anything at all - used to hide the toggle. */
export function canBuzz() {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

export function buzz(kind: Buzz) {
  if (!on || !canBuzz()) return;
  try {
    navigator.vibrate(PATTERN[kind]);
  } catch {
    // some browsers throw inside an iframe or with the page hidden
  }
}
