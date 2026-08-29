import { DEFAULT_PIECE, isPieceId, type PieceId } from "../race/pieces";

/**
 * The garage: which pieces you have, and which one you race.
 *
 * Pieces are earned by playing, and every condition below is something the
 * game already produces on its own - a win, a last place, a booster actually
 * fired, a quiz finished. Nothing here asks the player to grind a counter
 * that exists only to be ground; the turtle is for coming last, which is a
 * thing that was going to happen to you anyway.
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

export type GarageState = { equipped: PieceId; stats: Stats };

export type PieceInfo = {
  id: PieceId;
  name: string;
  /** what it is, in one breath */
  blurb: string;
  /** null = yours from the start */
  unlock: { label: string; got: (s: Stats) => boolean } | null;
};

export const PIECES: PieceInfo[] = [
  { id: "racer",  name: "경주차",   blurb: "기본. 빠르게 생겼다.",          unlock: null },
  { id: "duck",   name: "오리",     blurb: "왜 트랙에 있는지는 묻지 말자.", unlock: null },
  { id: "truck",  name: "트럭",     blurb: "짐칸은 비어 있다.",             unlock: null },
  {
    id: "bus", name: "버스", blurb: "다 같이 타고 간다.",
    unlock: { label: "3판 끝내기", got: (s) => s.games >= 3 },
  },
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
  {
    id: "pencil", name: "연필", blurb: "문제 푸는 말.",
    unlock: { label: "퀴즈 한 판 풀기", got: (s) => s.quizPlays >= 1 },
  },
  {
    id: "ufo", name: "UFO", blurb: "정답을 어디서 보고 온 것 같다.",
    unlock: { label: "퀴즈 전부 맞히기", got: (s) => s.quizPerfect },
  },
];

const KEY = "ddr.garage";

const EMPTY: Stats = {
  games: 0, wins: 0, lasts: 0, finishes: 0, boosts: 0,
  quizPlays: 0, quizBest: 0, quizPerfect: false,
};

export function isOwned(id: PieceId, stats: Stats) {
  const info = PIECES.find((p) => p.id === id);
  if (!info) return false;
  return !info.unlock || info.unlock.got(stats);
}

/** localStorage holds whatever was last written there, which may be anything. */
function read(): GarageState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { equipped: DEFAULT_PIECE, stats: { ...EMPTY } };
    const p = JSON.parse(raw) as Partial<GarageState>;
    const stats: Stats = { ...EMPTY };
    for (const k of Object.keys(EMPTY) as (keyof Stats)[]) {
      const v = (p.stats as Record<string, unknown> | undefined)?.[k];
      if (k === "quizPerfect") stats.quizPerfect = v === true;
      else if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
        (stats[k] as number) = Math.floor(v);
      }
    }
    // An equipped piece you do not own is not an error worth surfacing - it
    // is a save from before a rename, or cleared stats. Race the default.
    const equipped = isPieceId(p.equipped) && isOwned(p.equipped, stats)
      ? p.equipped
      : DEFAULT_PIECE;
    return { equipped, stats };
  } catch {
    return { equipped: DEFAULT_PIECE, stats: { ...EMPTY } };
  }
}

function write(state: GarageState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // a private window just means the garage resets next launch
  }
}

export function loadGarage(): GarageState {
  return read();
}

export function equippedPiece(): PieceId {
  return read().equipped;
}

export function equipPiece(id: PieceId): GarageState {
  const state = read();
  if (!isOwned(id, state.stats)) return state;
  const next = { ...state, equipped: id };
  write(next);
  return next;
}

/** Called once when a race ends. Returns what it unlocked, if anything. */
export function recordRace(r: {
  won: boolean;
  last: boolean;
  finished: boolean;
}): PieceId[] {
  const state = read();
  const before = state.stats;
  const stats: Stats = {
    ...before,
    games: before.games + 1,
    wins: before.wins + (r.won ? 1 : 0),
    lasts: before.lasts + (r.last ? 1 : 0),
    finishes: before.finishes + (r.finished ? 1 : 0),
  };
  write({ ...state, stats });
  return newlyOwned(before, stats);
}

/** Boosters are counted as they fire, not at the end - a game you quit still
 *  contained the moment you spent one. */
export function recordBoost(): PieceId[] {
  const state = read();
  const stats = { ...state.stats, boosts: state.stats.boosts + 1 };
  write({ ...state, stats });
  return newlyOwned(state.stats, stats);
}

export function recordQuiz(correct: number, total: number): PieceId[] {
  const state = read();
  const before = state.stats;
  const stats: Stats = {
    ...before,
    quizPlays: before.quizPlays + 1,
    quizBest: Math.max(before.quizBest, correct),
    quizPerfect: before.quizPerfect || (total > 0 && correct === total),
  };
  write({ ...state, stats });
  return newlyOwned(before, stats);
}

function newlyOwned(before: Stats, after: Stats): PieceId[] {
  return PIECES.filter((p) => !isOwned(p.id, before) && isOwned(p.id, after)).map((p) => p.id);
}
