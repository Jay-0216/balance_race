import type { Choice, Move, Player, RoundKind, RoundOutcome } from "./types";

/**
 * At 40 the simulation never once reached the line in 12 rounds - a winner
 * averaged about 14 cells - so the chequered flag was decoration and the
 * fourth backdrop theme (which is keyed to leader progress) never appeared.
 */
export const CELLS = 20;
export const ROUNDS = 12;
export const TIME_LIMIT = 10;

/** Announced in advance - knowing a reverse round is coming is the whole game. */
export function roundKind(round: number): RoundKind {
  if (round === 5) return "double";
  if (round === 8) return "reverse";
  if (round === ROUNDS) return "allin";
  return "normal";
}

export const KIND_LABEL: Record<RoundKind, string> = {
  normal: "",
  double: "더블 라운드 — 이동 2배",
  reverse: "역전 라운드 — 소수가 전진",
  allin: "올인 라운드 — 칸을 건다",
};

/**
 * Base gain for the advancing side.
 *
 * Two things the 1000-game simulation forced here. First, thresholds have to
 * land between shares a real table can produce: at eight players the only
 * splits are 5-3 (62.5%), 6-2 (75%), 7-1 (87.5%) and 8-0, so the plan's
 * "51~60% is close" band could never fire at all.
 *
 * Second, and less obvious: paying MORE for a narrow win turned out to help
 * the crowd, not the reader. The five in a 5-3 is still the crowd, and the
 * conformist bot is sitting in it - a +3 there pushed 무난이 from 18.7% to
 * 19.5% of wins and dropped lead changes from 3.1 to 2.5 a game. So ordinary
 * wins pay a flat 2, an overwhelming one pays 1, and the weight that is meant
 * to reward reading the room sits on the booster instead.
 */
export function baseGain(majorityShare: number): number {
  if (majorityShare >= 0.85) return 1;   // 7-1 or 8-0: everyone saw it coming
  return 2;                              // 5-3 or 6-2
}

/** The minority bet: it pays nothing now and a lot on the next round won. */
export const BOOSTER_GAIN = 6;

export const MINORITY_BOOSTER_THRESHOLD = 0.3;
/** default share of your cells put up in the all-in round */
export const ALLIN_STAKE = 0.2;
export const ALLIN_MIN = 0.1;
export const ALLIN_MAX = 0.5;

/** cells at risk for a given player, from a 0..1 share */
export function stakeFor(pos: number, share: number) {
  return Math.max(1, Math.round(pos * share));
}

/**
 * Resolves one round. Pure: takes players and their choices, returns the moves.
 * No timers, no rendering, no mutation of the input.
 */
export function resolveRound(
  players: Player[],
  choices: Record<number, Choice>,
  kind: RoundKind = "normal",
  /** per-player all-in share, 0..1; anyone missing bets ALLIN_STAKE */
  stakes: Record<number, number> = {}
): RoundOutcome {
  const countA = players.filter((p) => choices[p.id] === "a").length;
  const countB = players.length - countA;
  const tie = countA === countB;
  const majorityShare = Math.max(countA, countB) / players.length;
  const minorityShare = 1 - majorityShare;

  const majoritySide: Choice = countA > countB ? "a" : "b";
  const advancingSide: Choice | null = tie
    ? null
    : kind === "reverse"
      ? majoritySide === "a" ? "b" : "a"
      : majoritySide;

  const gain = tie ? 1 : baseGain(majorityShare) * (kind === "double" ? 2 : 1);

  const moves: Move[] = players.map((p) => {
    const from = p.pos;

    // A tie means nobody read the room, so nobody has earned a booster payout
    // either - it is neither spent nor granted.
    if (tie) {
      return {
        playerId: p.id, from, to: Math.min(CELLS, from + gain),
        advanced: true, boosterFired: false, boosterGained: false,
      };
    }

    const advanced = choices[p.id] === advancingSide;

    if (kind === "allin") {
      const stake = stakeFor(from, stakes[p.id] ?? ALLIN_STAKE);
      const to = advanced
        ? Math.min(CELLS, from + stake)
        : Math.max(0, from - stake);
      return { playerId: p.id, from, to, advanced, boosterFired: false, boosterGained: false, stake };
    }

    if (advanced) {
      const boosterFired = p.booster;
      const step = boosterFired ? BOOSTER_GAIN : gain;
      return {
        playerId: p.id, from, to: Math.min(CELLS, from + step),
        advanced: true, boosterFired, boosterGained: false,
      };
    }

    // Being in a tiny minority is a bet, not just a loss: it buys the next win.
    const boosterGained = !p.booster && minorityShare < MINORITY_BOOSTER_THRESHOLD && minorityShare > 0;
    return {
      playerId: p.id, from, to: from,
      advanced: false, boosterFired: false, boosterGained,
    };
  });

  return { kind, countA, countB, tie, advancingSide, majorityShare, gain, moves };
}

/** Applies an outcome, returning new players. Never mutates. */
export function applyOutcome(players: Player[], outcome: RoundOutcome): Player[] {
  const byId = new Map(outcome.moves.map((m) => [m.playerId, m]));
  return players.map((p) => {
    const m = byId.get(p.id);
    if (!m) return p;
    return {
      ...p,
      pos: m.to,
      booster: m.boosterFired ? false : m.boosterGained ? true : p.booster,
    };
  });
}

export function isOver(players: Player[], round: number): boolean {
  return round > ROUNDS || players.some((p) => p.pos >= CELLS);
}

export function ranked(players: Player[]): Player[] {
  return [...players].sort((x, y) => y.pos - x.pos || x.id - y.id);
}
