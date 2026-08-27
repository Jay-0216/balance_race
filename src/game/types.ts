export type Choice = "a" | "b";

export type Dilemma = {
  id: string;
  category: string;
  a: { text: string; emoji: string };
  b: { text: string; emoji: string };
  /** share of people expected to pick A - the yardstick the bots read */
  popularBias: number;
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
