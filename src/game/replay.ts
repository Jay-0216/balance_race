import { collectBotBoosts, collectBotChoices } from "./bots";
import { applyOutcome, resolveRound, roundKind } from "./rules";
import { rngFor } from "./rng";
import type { Choice, Dilemma, Player, RoundOutcome } from "./types";

/**
 * A room's whole state, recomputed from what the database actually stores.
 *
 * The database holds a frozen deck, a frozen roster, and the choices for every
 * round that has closed. Nothing else - no positions, no scores. Every client
 * replays this function over those inputs and lands on the same answer,
 * because resolveRound is pure and everything random here is seeded by the
 * room code and the round number.
 *
 * That is what makes the online game host-independent: there is no authority
 * to wait for, and a player who joins late or reloads catches up by replaying.
 */

export type Seat = {
  seat: number;
  name: string;
  color: string;
  bot: boolean;
  /** index into BOT_ROSTER, for a bot's personality */
  profile?: number;
};

/** what came back from room_close for one round */
export type ClosedRound = Record<number, { choice: Choice; useBoost: boolean; stake: number }>;

export type ReplayStep = { round: number; outcome: RoundOutcome; before: Player[]; after: Player[] };

export type Replay = { players: Player[]; steps: ReplayStep[] };

/**
 * A seat that never answered still has to have answered *something*, and it has
 * to be the same something on every device - so it comes from the seed rather
 * than from whoever noticed first. Solo does this with Math.random because
 * there is nobody to disagree with.
 */
function fillMissing(
  code: string,
  round: number,
  players: Player[],
  dilemma: Dilemma,
  closed: ClosedRound
): { choices: Record<number, Choice>; boosts: Record<number, boolean> } {
  const kind = roundKind(round);
  const rng = rngFor(code, round);
  // Bots first and always in seat order, so the generator is consumed in the
  // same sequence everywhere. Draw order is part of the agreement.
  const botChoices = collectBotChoices(players, dilemma, kind, rng);
  const botBoosts = collectBotBoosts(players, kind, rng);

  const choices: Record<number, Choice> = {};
  const boosts: Record<number, boolean> = {};
  for (const p of [...players].sort((x, y) => x.id - y.id)) {
    const given = closed[p.id];
    if (given) {
      choices[p.id] = given.choice;
      boosts[p.id] = given.useBoost;
    } else if (p.isBot) {
      choices[p.id] = botChoices[p.id] ?? "a";
      boosts[p.id] = botBoosts[p.id] ?? false;
    } else {
      // out of time, or gone. Seeded, so everyone fills it the same way.
      choices[p.id] = rng() < 0.5 ? "a" : "b";
      boosts[p.id] = false;
    }
  }
  return { choices, boosts };
}

export function replay(
  code: string,
  seats: Seat[],
  deck: Dilemma[],
  rounds: Record<number, ClosedRound>,
  makeStart: (seats: Seat[]) => Player[]
): Replay {
  let players = makeStart(seats);
  const steps: ReplayStep[] = [];

  for (let round = 1; round <= deck.length; round++) {
    const closed = rounds[round];
    if (!closed) break;                       // this round has not ended yet
    const dilemma = deck[round - 1];
    const { choices, boosts } = fillMissing(code, round, players, dilemma, closed);
    const stakes: Record<number, number> = {};
    for (const [seat, c] of Object.entries(closed)) stakes[Number(seat)] = c.stake;

    const outcome = resolveRound(players, choices, roundKind(round), stakes, boosts);
    const before = players;
    players = applyOutcome(players, outcome);
    steps.push({ round, outcome, before, after: players });
  }

  return { players, steps };
}
