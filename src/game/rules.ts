import type { Choice, Move, Player, RoundKind, RoundOutcome } from "./types";

/**
 * At 40 the simulation never once reached the line in 12 rounds - a winner
 * averaged about 14 cells - so the chequered flag was decoration and the
 * fourth backdrop theme (which is keyed to leader progress) never appeared.
 */
export const CELLS = 24;
export const ROUNDS = 12;
/**
 * Seconds on the clock. Ten was tight enough that reading a long dilemma and
 * then reading the room did not both fit - people were still parsing option B
 * when the timer started flashing, which turns a game about nerve into a game
 * about reading speed.
 */
export const TIME_LIMIT = 16;

/**
 * Announced in advance - knowing a reverse round is coming is the whole game.
 *
 * They sit at 4 / 7 / 10 rather than 5 / 8 / 12 because the simulation says a
 * game runs about ten rounds before somebody crosses the line. With the all-in
 * round parked at 12, most games simply never had one.
 */
export function roundKind(round: number): RoundKind {
  if (round === 4) return "double";
  if (round === 7) return "reverse";
  if (round === 10) return "allin";
  return "normal";
}

/**
 * Split in two because the announcement and the reminder are different things:
 * the slam wants a name big enough to fill the screen and a rule underneath
 * it, the corner chip that stays up all round wants one line.
 */
export const KIND_TITLE: Record<RoundKind, string> = {
  normal: "",
  double: "더블 라운드",
  reverse: "역전 라운드",
  allin: "올인 라운드",
};

export const KIND_SUB: Record<RoundKind, string> = {
  normal: "",
  double: "이동 2배",
  reverse: "소수가 전진한다",
  allin: "가진 칸을 건다",
};

export const KIND_LABEL: Record<RoundKind, string> = {
  normal: "",
  double: `${KIND_TITLE.double} — ${KIND_SUB.double}`,
  reverse: `${KIND_TITLE.reverse} — ${KIND_SUB.reverse}`,
  allin: `${KIND_TITLE.allin} — ${KIND_SUB.allin}`,
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

/**
 * The booster is charged, not granted.
 *
 * It used to be a flag: land in a small enough minority and the next round you
 * won paid a flat +6 - a third of the whole track, handed out automatically,
 * on a round you did not choose. That is not a gamble, it is a windfall, and
 * it swung games on its own.
 *
 * Now taking the small side fills a gauge. Once it is full the owner may spend
 * it on a round of their choosing, and it doubles that round's gain. Spend it
 * on a round you then lose and it is simply gone. The cost of being wrong is
 * what makes choosing when to use it interesting.
 */
export const BOOSTER_CHARGE_MAX = 2;
export const BOOSTER_MULTIPLIER = 4;

/** charge earned for being on the losing side, by how small that side was */
export function chargeFor(minorityShare: number): number {
  if (minorityShare <= 0) return 0;
  return minorityShare < MINORITY_BOOSTER_THRESHOLD ? 2 : 1;
}

export function isArmed(charge: number) {
  return charge >= BOOSTER_CHARGE_MAX;
}

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
  stakes: Record<number, number> = {},
  /** who is spending a full booster charge on this round */
  boosts: Record<number, boolean> = {}
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

    // A tie means nobody read the room: everyone inches forward, nobody
    // charges, and a spent booster is not consumed.
    if (tie) {
      return {
        playerId: p.id, from, to: Math.min(CELLS, from + gain),
        advanced: true, boosterFired: false, chargeGained: 0,
      };
    }

    const advanced = choices[p.id] === advancingSide;
    // spending needs a full gauge; asking without one is simply ignored
    const spending = !!boosts[p.id] && isArmed(p.charge);

    if (kind === "allin") {
      const stake = stakeFor(from, stakes[p.id] ?? ALLIN_STAKE);
      const to = advanced
        ? Math.min(CELLS, from + stake * (spending ? BOOSTER_MULTIPLIER : 1))
        : Math.max(0, from - stake);
      return {
        playerId: p.id, from, to, advanced,
        boosterFired: spending, chargeGained: 0, stake,
      };
    }

    if (advanced) {
      const step = spending ? gain * BOOSTER_MULTIPLIER : gain;
      return {
        playerId: p.id, from, to: Math.min(CELLS, from + step),
        advanced: true, boosterFired: spending, chargeGained: 0,
      };
    }

    // Taking the small side pays nothing now; it fills the gauge instead.
    // Spending on a round you then lose burns the charge for nothing - that
    // risk is what makes the timing a decision rather than a formality.
    return {
      playerId: p.id, from, to: from,
      advanced: false, boosterFired: spending,
      chargeGained: spending ? 0 : chargeFor(minorityShare),
    };
  });

  return { kind, countA, countB, tie, advancingSide, majorityShare, gain, moves };
}

/**
 * What happened to one player this round, as the two facts that matter:
 * which side they were on, and whether it moved them.
 *
 * These come apart on a reverse round - the round where the minority is the
 * side that advances - and conflating them is a bug the game shipped with:
 * the reveal asked only "did I advance", so going small on a reverse round
 * and being paid for it announced 다수!, and reading the room correctly to
 * stay with the crowd announced 소수…. Both backwards, on the one round where
 * a player most needs to be told what just happened.
 */
export type SideStory =
  | "majority-ahead"    // the ordinary win
  | "minority-ahead"    // a reverse round paying off
  | "majority-stuck"    // a reverse round biting
  | "minority-stuck"
  | "tie";

export function sideStory(outcome: RoundOutcome, myChoice: Choice | null): SideStory {
  if (outcome.tie) return "tie";
  const big: Choice = outcome.countA > outcome.countB ? "a" : "b";
  const inMajority = myChoice === big;
  return myChoice === outcome.advancingSide
    ? inMajority ? "majority-ahead" : "minority-ahead"
    : inMajority ? "majority-stuck" : "minority-stuck";
}

/** Applies an outcome, returning new players. Never mutates. */
export function applyOutcome(players: Player[], outcome: RoundOutcome): Player[] {
  const byId = new Map(outcome.moves.map((m) => [m.playerId, m]));
  return players.map((p) => {
    const m = byId.get(p.id);
    if (!m) return p;
    const charge = m.boosterFired
      ? 0
      : Math.min(BOOSTER_CHARGE_MAX, p.charge + m.chargeGained);
    return { ...p, pos: m.to, charge };
  });
}

export function isOver(players: Player[], round: number): boolean {
  return round > ROUNDS || players.some((p) => p.pos >= CELLS);
}

export function ranked(players: Player[]): Player[] {
  return [...players].sort((x, y) => y.pos - x.pos || x.id - y.id);
}

export type Placement = {
  player: Player;
  /** standard competition ranking: 1, 1, 3 - never 1, 2, 3 for a shared cell */
  place: number;
  /** somebody else finished on exactly this cell */
  shared: boolean;
};

/**
 * Places, not row numbers.
 *
 * ranked() sorts, and sorting has to break ties somehow - here by player id,
 * which is seat order and means nothing. Reading a place off that sorted list
 * quietly turns "we both finished on 24" into "you were second", deciding a
 * dead heat by who happened to sit down first. Two players on the same cell
 * are the same place, and the next player skips.
 */
export function placements(players: Player[]): Placement[] {
  const order = ranked(players);
  const out: Placement[] = [];
  for (let i = 0; i < order.length; i++) {
    const p = order[i];
    // first row at this cell sets the place; everyone level with it shares it
    const place = i > 0 && order[i - 1].pos === p.pos ? out[i - 1].place : i + 1;
    out.push({ player: p, place, shared: false });
  }
  for (const row of out) {
    row.shared = out.some((o) => o !== row && o.place === row.place);
  }
  return out;
}
