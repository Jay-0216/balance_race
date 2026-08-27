/**
 * Plays the game head-to-head many times with no UI, to answer the question
 * the plan puts at the end of Phase 2: does anyone always win, and does the
 * order settle early? If a profile dominates or rank 1 never changes after
 * round 3, the rules are wrong, not the renderer.
 */
import { collectBotBoosts, collectBotChoices } from "../src/game/bots";
import { applyOutcome, CELLS, isOver, ranked, resolveRound, roundKind, ROUNDS } from "../src/game/rules";
import { dealDeck, makePlayers } from "../src/game/setup";
import type { Choice, Player } from "../src/game/types";

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The human seat is played by a middle-of-the-road bot so it is comparable. */
const HUMAN_PROFILE = { conformity: 0.5, contrarian: 0.25, risk: 0.45, noise: 0.4 };

type Stats = {
  wins: Record<string, number>;
  leadChanges: number[];
  finalSpread: number[];
  ties: number;
  boosterFires: number;
  rounds: number[];
  reachedFinish: number;
  specialsPlayed: number;
};

function playGame(seed: number, stats: Stats) {
  const rng = mulberry32(seed);
  let players: Player[] = makePlayers().map((p) =>
    p.isBot ? p : { ...p, isBot: true, profile: HUMAN_PROFILE }
  );
  const deck = dealDeck(ROUNDS, rng);

  let round = 1;
  let leadChanges = 0;
  let lastLeader = -1;

  while (round <= ROUNDS && !players.some((p) => p.pos >= CELLS)) {
    const kind = roundKind(round);
    const dilemma = deck[(round - 1) % deck.length];
    const choices = collectBotChoices(players, dilemma, kind, rng) as Record<number, Choice>;
    const boosts = collectBotBoosts(players, kind, rng);
    const outcome = resolveRound(players, choices, kind, {}, boosts);

    if (outcome.tie) stats.ties++;
    stats.boosterFires += outcome.moves.filter((m) => m.boosterFired).length;

    players = applyOutcome(players, outcome);

    const leader = ranked(players)[0].id;
    if (round > 1 && leader !== lastLeader) leadChanges++;
    lastLeader = leader;
    round++;
  }

  const order = ranked(players);
  stats.wins[order[0].name] = (stats.wins[order[0].name] ?? 0) + 1;
  stats.leadChanges.push(leadChanges);
  stats.finalSpread.push(order[0].pos - order[order.length - 1].pos);
  stats.rounds.push(round - 1);
  stats.specialsPlayed += Math.min(3, [4, 7, 10].filter((r) => r < round).length);
  if (players.some((p) => p.pos >= CELLS)) stats.reachedFinish++;
  void isOver;
}

const N = Number(process.argv[2] ?? 1000);
const stats: Stats = {
  wins: {}, leadChanges: [], finalSpread: [], ties: 0,
  boosterFires: 0, rounds: [], reachedFinish: 0, specialsPlayed: 0,
};
for (let i = 1; i <= N; i++) playGame(i, stats);

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const pct = (n: number) => ((n / N) * 100).toFixed(1) + "%";

console.log(`${N} games\n`);
console.log("우승 분포 (고를수록 건강함)");
Object.entries(stats.wins)
  .sort((a, b) => b[1] - a[1])
  .forEach(([name, n]) => {
    const bar = "█".repeat(Math.round((n / N) * 120));
    console.log(`  ${name.padEnd(6)} ${pct(n).padStart(6)}  ${bar}`);
  });

const share = Object.values(stats.wins).map((n) => n / N);
console.log(`\n최다 우승 점유율 : ${(Math.max(...share) * 100).toFixed(1)}%  (이상적 12.5%)`);
console.log(`선두 교체 / 게임  : ${mean(stats.leadChanges).toFixed(2)}회`);
console.log(`최종 1위-꼴찌 격차: ${mean(stats.finalSpread).toFixed(1)}칸`);
console.log(`평균 라운드 수    : ${mean(stats.rounds).toFixed(1)}`);
console.log(`결승선 도달로 종료: ${pct(stats.reachedFinish)}`);
console.log(`동점 라운드       : ${(stats.ties / N).toFixed(2)}회/게임`);
console.log(`부스터 발동       : ${(stats.boosterFires / N).toFixed(2)}회/게임`);
console.log(`특수 라운드 도달  : ${(stats.specialsPlayed / N).toFixed(2)} / 3`);
