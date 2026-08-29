import type { PieceId } from "../race/pieces";

/**
 * 볼트 (⚡) — what you win and what you spend.
 *
 * The name does two jobs at once, which is why it beat the alternatives:
 * a 볼트 is the electrical volt of the booster's ⚡, and it is also the bolt
 * in a garage drawer. Both halves of this game already look like that. It is
 * also short, it takes a number in front without reading oddly (300볼트), and
 * it cannot be confused with 칸, which is already the race's score - a shop
 * priced in the same unit as the track would be genuinely confusing.
 *
 * Changing it later is one constant and one emoji.
 */
export const COIN = "볼트";
export const COIN_ICON = "⚡";

/** What a race pays. Placing well is worth more than turning up, but turning
 *  up is never worth nothing - a mode that pays zero is a mode you stop
 *  playing after you lose once. */
export const PRIZE = {
  first: 300,
  podium: 150,
  rest: 60,
  /** for actually crossing the line rather than running out of rounds */
  finish: 100,
} as const;

/** A quiz pays per answer, so a bad run still buys something. */
export const QUIZ_PRIZE = { each: 25, perfect: 150 } as const;

export type ShopKind = "piece" | "paint" | "gear";

export type ShopItem = {
  /** unique across every kind: "piece:bus", "paint:cherry", "gear:jumpstart" */
  id: string;
  kind: ShopKind;
  name: string;
  blurb: string;
  price: number;
};

/**
 * Paints for your own piece.
 *
 * Deliberately none of these is a bot colour. The seven rivals already own
 * the muted end of the wheel, and a player painting their piece the same
 * green as 청개구리 would be paying to become harder to find on the track.
 */
export const PAINTS: { id: string; name: string; hex: string; price: number }[] = [
  { id: "gold",     name: "기본 금색", hex: "#f0b429", price: 0 },
  { id: "cherry",   name: "체리",     hex: "#ff5d5d", price: 250 },
  { id: "lime",     name: "라임",     hex: "#a8e05f", price: 250 },
  { id: "sky",      name: "하늘",     hex: "#5bc8ff", price: 250 },
  { id: "grape",    name: "포도",     hex: "#b06bff", price: 300 },
  { id: "peach",    name: "복숭아",   hex: "#ff7ac2", price: 300 },
  { id: "mint",     name: "민트",     hex: "#4fe3c1", price: 300 },
  { id: "cobalt",   name: "코발트",   hex: "#4f7dff", price: 400 },
  { id: "platinum", name: "백금",     hex: "#e8eef2", price: 600 },
];

export const DEFAULT_PAINT = "gold";

export function paintHex(id: string): string {
  return PAINTS.find((p) => p.id === id)?.hex ?? PAINTS[0].hex;
}

/** Pieces you buy. The rest are free from the start or earned by playing. */
export const PIECE_PRICES: Partial<Record<PieceId, number>> = {
  bus: 400,
  pencil: 500,
  ufo: 1200,
};

/**
 * One thing that is not a decoration.
 *
 * Solo only, and said so on the label: the same perk in a live session would
 * be someone paying for an advantage over a classroom, which is a different
 * kind of game from the one this is.
 */
export const GEAR: ShopItem[] = [
  {
    id: "gear:jumpstart",
    kind: "gear",
    name: "부스터 시동",
    blurb: "혼자 하기에서 충전 1칸을 갖고 시작한다. (라이브·레이스 방에는 안 붙는다)",
    price: 700,
  },
];

export const JUMPSTART = "gear:jumpstart";
