import { DEFAULT_PIECE, isPieceId, type PieceId } from "../race/pieces";
import {
  DEFAULT_PAINT, GEAR, PAINTS, PIECE_PRICES, PRIZE, QUIZ_PRIZE,
} from "./shop";

/**
 * What I own, what I am racing, and how many 볼트 I have.
 *
 * Two ways to get a piece, and they are kept apart on purpose:
 *   - *earned* ones are jokes about how you played (the turtle is for coming
 *     last, which was going to happen to you anyway),
 *   - *bought* ones cost 볼트.
 * Mixing the two into "achievement OR money" would have made both feel like
 * neither.
 *
 * This is all local. There is no server copy and deliberately so: a garage
 * that needs an account is a garage a guest cannot open, and the whole game
 * works signed out.
 */

export type Stats = {
  /** games played to the end */
  games: number;
  wins: number;
  /** finished last (or joint last) */
  lasts: number;
  /** crossed the line rather than running out of rounds */
  finishes: number;
  /** boosters actually spent */
  boosts: number;
  quizPlays: number;
  /** best number of correct answers in one quiz run */
  quizBest: number;
  /** a full-marks quiz run */
  quizPerfect: boolean;
};

export type GarageState = {
  equipped: PieceId;
  paint: string;
  /** everything bought, by shop id */
  owned: string[];
  bolts: number;
  /** lifetime earnings, so the shop can say what you have made */
  earned: number;
  stats: Stats;
};

export type PieceInfo = {
  id: PieceId;
  name: string;
  /** what it is, in one breath */
  blurb: string;
  /** null = yours from the start, or bought (see PIECE_PRICES) */
  unlock: { label: string; got: (s: Stats) => boolean } | null;
};

export const PIECES: PieceInfo[] = [
  { id: "racer",  name: "경주차",   blurb: "기본. 빠르게 생겼다.",          unlock: null },
  { id: "duck",   name: "오리",     blurb: "왜 트랙에 있는지는 묻지 말자.", unlock: null },
  { id: "truck",  name: "트럭",     blurb: "짐칸은 비어 있다.",             unlock: null },
  {
    id: "cat", name: "고양이", blurb: "이기고 싶을 때만 뛴다.",
    unlock: { label: "1등 한 번", got: (s) => s.wins >= 1 },
  },
  {
    id: "turtle", name: "거북이", blurb: "느리지만 끝까지 간다.",
    unlock: { label: "꼴찌 한 번", got: (s) => s.lasts >= 1 },
  },
  {
    id: "rocket", name: "로켓", blurb: "부스터가 어울린다.",
    unlock: { label: "부스터 터뜨리기", got: (s) => s.boosts >= 1 },
  },
  { id: "bus",    name: "버스",   blurb: "다 같이 타고 간다.",              unlock: null },
  { id: "pencil", name: "연필",   blurb: "문제 푸는 말.",                   unlock: null },
  { id: "ufo",    name: "UFO",    blurb: "정답을 어디서 보고 온 것 같다.",  unlock: null },
];

const KEY = "ddr.garage";

const EMPTY: Stats = {
  games: 0, wins: 0, lasts: 0, finishes: 0, boosts: 0,
  quizPlays: 0, quizBest: 0, quizPerfect: false,
};

const FRESH: GarageState = {
  equipped: DEFAULT_PIECE, paint: DEFAULT_PAINT, owned: [],
  bolts: 0, earned: 0, stats: { ...EMPTY },
};

export const pieceKey = (id: PieceId) => `piece:${id}`;
export const paintKey = (id: string) => `paint:${id}`;

export function isOwned(id: PieceId, state: GarageState): boolean {
  const info = PIECES.find((p) => p.id === id);
  if (!info) return false;
  if (info.unlock) return info.unlock.got(state.stats);
  if (PIECE_PRICES[id] !== undefined) return state.owned.includes(pieceKey(id));
  return true;                                  // free from the start
}

export function ownsPaint(id: string, state: GarageState): boolean {
  const paint = PAINTS.find((p) => p.id === id);
  if (!paint) return false;
  return paint.price === 0 || state.owned.includes(paintKey(id));
}

export function ownsGear(id: string, state: GarageState): boolean {
  return state.owned.includes(id);
}

/**
 * A save from anywhere - localStorage, or a profile row on another device -
 * made safe. Both sources are equally untrustworthy, so there is one
 * validator and not two.
 */
function parse(p: Partial<GarageState>): GarageState {
  const stats: Stats = { ...EMPTY };
  for (const k of Object.keys(EMPTY) as (keyof Stats)[]) {
    const v = (p.stats as Record<string, unknown> | undefined)?.[k];
    if (k === "quizPerfect") stats.quizPerfect = v === true;
    else if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
      (stats[k] as number) = Math.floor(v);
    }
  }

  const known = new Set([
    ...PIECES.map((x) => pieceKey(x.id)),
    ...PAINTS.map((x) => paintKey(x.id)),
    ...GEAR.map((x) => x.id),
  ]);
  const owned = Array.isArray(p.owned)
    ? [...new Set(p.owned.filter((x): x is string => typeof x === "string" && known.has(x)))]
    : [];

  const num = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;

  const state: GarageState = {
    equipped: DEFAULT_PIECE,
    paint: PAINTS.some((x) => x.id === p.paint) ? (p.paint as string) : DEFAULT_PAINT,
    owned, bolts: num(p.bolts), earned: num(p.earned), stats,
  };
  // An equipped piece you do not own is not an error worth surfacing - it
  // is a save from before a rename, or cleared stats. Race the default.
  if (isPieceId(p.equipped) && isOwned(p.equipped, state)) state.equipped = p.equipped;
  if (!ownsPaint(state.paint, state)) state.paint = DEFAULT_PAINT;
  return state;
}

/** localStorage holds whatever was last written there, which may be anything. */
function read(): GarageState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...FRESH, stats: { ...EMPTY } };
    return parse(JSON.parse(raw) as Partial<GarageState>);
  } catch {
    return { ...FRESH, stats: { ...EMPTY } };
  }
}

/**
 * Anyone who wants to know the garage changed.
 *
 * A listener rather than a call into the network layer: this module is game
 * state and knows nothing about accounts, and keeping it that way is what lets
 * the whole game run signed out.
 */
type Watcher = (state: GarageState) => void;
const watchers = new Set<Watcher>();

export function onGarageChange(fn: Watcher) {
  watchers.add(fn);
  return () => watchers.delete(fn);
}

function write(state: GarageState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // a private window just means the garage resets next launch
  }
  for (const fn of watchers) fn(state);
}

/**
 * Two saves of the same garage, combined so that nothing is ever lost.
 *
 * Every number takes the larger side and everything owned is unioned, which
 * means a merge can occasionally be generous - buy something online, come back
 * with an older local save, and the union keeps the item while the max keeps
 * the older, higher balance.
 *
 * That is the deliberate half of the trade. The other direction loses a kid's
 * stuff, and there is no real money here: the shop sells paint, pieces and one
 * solo-only perk. **Given a choice between occasionally too generous and
 * occasionally taking things away, a game like this picks generous.**
 */
export function mergeGarage(a: GarageState, b: GarageState): GarageState {
  const stats: Stats = { ...EMPTY };
  for (const k of Object.keys(EMPTY) as (keyof Stats)[]) {
    if (k === "quizPerfect") stats.quizPerfect = a.stats.quizPerfect || b.stats.quizPerfect;
    else (stats[k] as number) = Math.max(a.stats[k] as number, b.stats[k] as number);
  }
  const merged: GarageState = {
    equipped: DEFAULT_PIECE,
    paint: DEFAULT_PAINT,
    owned: [...new Set([...a.owned, ...b.owned])],
    bolts: Math.max(a.bolts, b.bolts),
    earned: Math.max(a.earned, b.earned),
    stats,
  };
  // keep whichever side's choices still make sense after the merge, mine first
  for (const pick of [a.equipped, b.equipped]) {
    if (isOwned(pick, merged)) { merged.equipped = pick; break; }
  }
  for (const pick of [a.paint, b.paint]) {
    if (ownsPaint(pick, merged)) { merged.paint = pick; break; }
  }
  return merged;
}

/** Replace the whole save - used when a merged copy comes back from the cloud. */
export function putGarage(state: GarageState): GarageState {
  write(state);
  return state;
}

/** Whatever came out of a profile row, checked by the same validator. */
export function parseGarage(raw: unknown): GarageState | null {
  if (!raw || typeof raw !== "object") return null;
  return parse(raw as Partial<GarageState>);
}

export function loadGarage(): GarageState {
  return read();
}

export function equippedPiece(): PieceId {
  return read().equipped;
}

/** The colour my piece is painted, everywhere it is drawn. */
export function myPaint(): string {
  const s = read();
  return PAINTS.find((p) => p.id === s.paint)?.hex ?? PAINTS[0].hex;
}

export function hasJumpstart(): boolean {
  return read().owned.includes("gear:jumpstart");
}

export function equipPiece(id: PieceId): GarageState {
  const state = read();
  if (!isOwned(id, state)) return state;
  const next = { ...state, equipped: id };
  write(next);
  return next;
}

export function equipPaint(id: string): GarageState {
  const state = read();
  if (!ownsPaint(id, state)) return state;
  const next = { ...state, paint: id };
  write(next);
  return next;
}

/** Buying is the only thing that takes 볼트 away, and it refuses to overdraw. */
export function buy(id: string, price: number): { state: GarageState; bought: boolean } {
  const state = read();
  if (state.owned.includes(id)) return { state, bought: false };
  if (state.bolts < price) return { state, bought: false };
  const next: GarageState = {
    ...state, bolts: state.bolts - price, owned: [...state.owned, id],
  };
  write(next);
  return { state: next, bought: true };
}

export type Reward = { bolts: number; unlocked: PieceId[] };

/** Called once when a race ends. */
export function recordRace(r: {
  place: number;
  won: boolean;
  last: boolean;
  finished: boolean;
}): Reward {
  const state = read();
  const before = state.stats;
  const stats: Stats = {
    ...before,
    games: before.games + 1,
    wins: before.wins + (r.won ? 1 : 0),
    lasts: before.lasts + (r.last ? 1 : 0),
    finishes: before.finishes + (r.finished ? 1 : 0),
  };
  const bolts =
    (r.place === 1 ? PRIZE.first : r.place <= 3 ? PRIZE.podium : PRIZE.rest) +
    (r.finished ? PRIZE.finish : 0);

  const next: GarageState = {
    ...state, stats, bolts: state.bolts + bolts, earned: state.earned + bolts,
  };
  write(next);
  return { bolts, unlocked: newlyOwned(state, next) };
}

/** Boosters are counted as they fire, not at the end - a game you quit still
 *  contained the moment you spent one. */
export function recordBoost(): Reward {
  const state = read();
  const next = { ...state, stats: { ...state.stats, boosts: state.stats.boosts + 1 } };
  write(next);
  return { bolts: 0, unlocked: newlyOwned(state, next) };
}

export function recordQuiz(correct: number, total: number): Reward {
  const state = read();
  const before = state.stats;
  const perfect = total > 0 && correct === total;
  const stats: Stats = {
    ...before,
    quizPlays: before.quizPlays + 1,
    quizBest: Math.max(before.quizBest, correct),
    quizPerfect: before.quizPerfect || perfect,
  };
  const bolts = correct * QUIZ_PRIZE.each + (perfect ? QUIZ_PRIZE.perfect : 0);
  const next: GarageState = {
    ...state, stats, bolts: state.bolts + bolts, earned: state.earned + bolts,
  };
  write(next);
  return { bolts, unlocked: newlyOwned(state, next) };
}

function newlyOwned(before: GarageState, after: GarageState): PieceId[] {
  return PIECES.filter((p) => !isOwned(p.id, before) && isOwned(p.id, after)).map((p) => p.id);
}
