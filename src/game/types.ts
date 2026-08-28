export type Choice = "a" | "b";

export type Dilemma = {
  id: string;
  category: string;
  a: { text: string; emoji: string };
  b: { text: string; emoji: string };
  /** share of people expected to pick A - the yardstick the bots read */
  popularBias: number;
};

/**
 * A quiz card: same two-button shape as a dilemma, but one side is right.
 *
 * The deck (src/data/quizzes.json) is written and checked; the quiz *mode* is
 * not built yet, and it cannot simply reuse the race: this game scores you for
 * reading the room, and a question with a correct answer has no room to read.
 * Scoring, bots and the reveal all have to be rethought, so the cards wait
 * here rather than being half-wired into a mode that would play wrong.
 */
export type Quiz = {
  id: string;
  category: string;
  question: string;
  a: { text: string; emoji: string };
  b: { text: string; emoji: string };
  answer: Choice;
  /** one line of why, shown after the reveal */
  note: string;
};

export type BotProfile = {
  /** pull toward whatever is popular */
  conformity: number;
  /** deliberate pull away from it */
  contrarian: number;
  /** appetite for the booster and the all-in stake */
  risk: number;
  /** plain unpredictability */
  noise: number;
};

export type Player = {
  id: number;
  name: string;
  color: string;
  isBot: boolean;
  profile?: BotProfile;
  /** position in cells - this is the score */
  pos: number;
  /**
   * Booster charge, 0..BOOSTER_CHARGE_MAX. Picking the minority fills it; it
   * is never spent automatically. The owner decides which round to spend it
   * on, which is the whole point - an automatic payout is not a gamble.
   */
  charge: number;
};

/** Special rounds are announced before they are played; that is the point. */
export type RoundKind = "normal" | "double" | "reverse" | "allin";

export type Move = {
  playerId: number;
  from: number;
  to: number;
  /** did this player end up on the advancing side */
  advanced: boolean;
  /** spent a full charge on this round */
  boosterFired: boolean;
  /** charge earned this round by taking the small side */
  chargeGained: number;
  stake?: number;
};

export type RoundOutcome = {
  kind: RoundKind;
  countA: number;
  countB: number;
  tie: boolean;
  /** the side that advances - already accounts for a reverse round */
  advancingSide: Choice | null;
  /** share held by the larger side, 0.5..1 */
  majorityShare: number;
  gain: number;
  moves: Move[];
};
