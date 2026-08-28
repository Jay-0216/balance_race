import dilemmaData from "../data/dilemmas.json";
import { getIdentity } from "../net/identity";
import { BOT_ROSTER } from "./bots";
import type { Dilemma, Player } from "./types";

export const DILEMMAS = dilemmaData as Dilemma[];

/**
 * Approved player-written cards, once they have arrived. Kept module-level
 * rather than in React state because dealDeck runs inside a useState
 * initialiser - a deck that is one render behind would deal the built-in
 * cards on the first game of every session.
 */
let extra: Dilemma[] = [];

export function addApprovedCards(cards: Dilemma[]) {
  const seen = new Set(DILEMMAS.map((d) => d.id));
  extra = cards.filter((c) => !seen.has(c.id));
}

export const PLAYER_COLORS = [
  "#f0b429", "#9aa9b4", "#7fb89a", "#b79acb",
  "#c9a47e", "#7fa3c9", "#c98fa6", "#a5b87f",
];

/**
 * Seat 0 is always the human. The display name comes from the identity module
 * rather than a literal, so a real login later changes who "나" is without
 * touching the game.
 */
export function makePlayers(botCount = 7): Player[] {
  const me: Player = {
    id: 0,
    name: getIdentity().nickname,
    color: PLAYER_COLORS[0],
    isBot: false,
    pos: 0,
    charge: 0,
  };
  const bots = BOT_ROSTER.slice(0, botCount).map((b, i) => ({
    id: i + 1,
    name: b.name,
    color: PLAYER_COLORS[(i + 1) % PLAYER_COLORS.length],
    isBot: true,
    profile: b.profile,
    pos: 0,
    charge: 0,
  }));
  return [me, ...bots];
}

/** A shuffled deck, so three games in a row never repeat a card. */
export function dealDeck(count: number, rng: () => number = Math.random): Dilemma[] {
  const pool = [...DILEMMAS, ...extra];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}
