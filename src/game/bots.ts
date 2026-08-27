import type { BotProfile, Choice, Dilemma, Player, RoundKind } from "./types";
import { MINORITY_BOOSTER_THRESHOLD } from "./rules";

/**
 * Bot personalities are meant to be readable. Once a player learns that
 * 청개구리 goes the other way, the guessing game gains a second layer - so the
 * names advertise the profile on purpose.
 */
export const BOT_ROSTER: { name: string; profile: BotProfile }[] = [
  { name: "무난이", profile: { conformity: 0.9, contrarian: 0.05, risk: 0.15, noise: 0.2 } },
  { name: "청개구리", profile: { conformity: 0.05, contrarian: 0.8, risk: 0.6, noise: 0.3 } },
  { name: "눈치백단", profile: { conformity: 0.8, contrarian: 0.05, risk: 0.25, noise: 0.1 } },
  { name: "도박러", profile: { conformity: 0.3, contrarian: 0.45, risk: 0.9, noise: 0.45 } },
  { name: "대충이", profile: { conformity: 0.35, contrarian: 0.2, risk: 0.4, noise: 0.7 } },
  { name: "츤츤이", profile: { conformity: 0.55, contrarian: 0.4, risk: 0.5, noise: 0.35 } },
  { name: "몰빵이", profile: { conformity: 0.65, contrarian: 0.15, risk: 0.75, noise: 0.3 } },
];

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

export type BotContext = {
  kind: RoundKind;
  /** trailing badly makes the risky play more attractive */
  behindBy: number;
  hasBooster: boolean;
  rng?: () => number;
};

/**
 * Probability of picking A, then a draw. Conformity amplifies the popular
 * side, contrarian flips it, and risk pushes toward the minority when a
 * booster is worth chasing.
 */
export function choiceProbability(
  profile: BotProfile,
  dilemma: Dilemma,
  ctx: BotContext
): number {
  const bias = dilemma.popularBias;
  const lean = bias - 0.5;

  let p = bias;
  p += profile.conformity * lean * 0.8;
  p -= profile.contrarian * lean * 1.4;

  // Chasing the booster means deliberately joining the small side. Only worth
  // it without one in hand, and more tempting the further behind you are.
  if (!ctx.hasBooster && ctx.kind === "normal") {
    const appetite = profile.risk * clamp(ctx.behindBy / 12, 0, 1);
    p -= Math.sign(lean) * appetite * MINORITY_BOOSTER_THRESHOLD;
  }

  // Everyone knows a reverse round inverts the payoff, so everyone aims for
  // the small side - which is exactly how it stops being small.
  if (ctx.kind === "reverse") p -= lean * (0.6 + profile.conformity * 0.5);

  return clamp(p, 0.02, 0.98);
}

export function botChoice(profile: BotProfile, dilemma: Dilemma, ctx: BotContext): Choice {
  const rng = ctx.rng ?? Math.random;
  const p = choiceProbability(profile, dilemma, ctx);
  return rng() < p + (rng() - 0.5) * profile.noise * 0.4 ? "a" : "b";
}

export function collectBotChoices(
  players: Player[],
  dilemma: Dilemma,
  kind: RoundKind,
  rng?: () => number
): Record<number, Choice> {
  const leader = Math.max(...players.map((p) => p.pos));
  const out: Record<number, Choice> = {};
  for (const p of players) {
    if (!p.isBot || !p.profile) continue;
    out[p.id] = botChoice(p.profile, dilemma, {
      kind, behindBy: leader - p.pos, hasBooster: p.booster, rng,
    });
  }
  return out;
}
