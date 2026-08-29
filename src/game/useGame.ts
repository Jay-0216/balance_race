import { useCallback, useEffect, useRef, useState } from "react";
import { collectBotBoosts, collectBotChoices } from "./bots";
import {
  ALLIN_STAKE, applyOutcome, CELLS, ranked, resolveRound, roundKind, ROUNDS,
  TIME_LIMIT,
} from "./rules";
import { buzz } from "../ui/haptics";
import { play } from "../ui/sound";
import { dealDeck, makePlayers } from "./setup";
import type { Choice, Dilemma, Player, RoundKind, RoundOutcome } from "./types";

/**
 * choosing → reveal → moving → (next round | done)
 *
 * The phases exist because the reveal is the game's high point and needs room
 * to breathe. Everything here is timing and bookkeeping; who moves how far is
 * decided by the pure rules in ./rules so it can be simulated without a screen.
 */
export type Phase = "choosing" | "reveal" | "moving" | "done";

export const REVEAL_MS = 900;
export const MOVING_MS = 1700;

/**
 * What a game looks like to the screen that draws it.
 *
 * Solo and online produce this same shape, so GameScreen has no idea which one
 * it is showing - which is what stopped the online race from needing a second
 * copy of the screen.
 */
export type GameLike = {
  players: Player[];
  /** which player is me. Solo it is always seat 0; online it is my seat. */
  meId: number;
  round: number;
  kind: RoundKind;
  dilemma: Dilemma;
  phase: Phase;
  outcome: RoundOutcome | null;
  outcomeSeq: number;
  myChoice: Choice | null;
  lockedCount: number;
  myLockIndex: number;
  deadline: number;
  timedOut: boolean;
  stake: number;
  setStake: (v: number) => void;
  useBoost: boolean;
  setUseBoost: (v: boolean) => void;
  pick: (c: Choice) => void;
  restart: () => void;
  /** online rooms cannot be replayed on the spot; leaving is the way out */
  canRestart: boolean;
};

export type GameState = {
  players: Player[];
  round: number;
  dilemma: Dilemma;
  phase: Phase;
  outcome: RoundOutcome | null;
  /**
   * Bumped once per resolution and never again. The round number cannot stand
   * in for it: the round counter increments while the phase is still "moving"
   * and the outcome is still on screen, so anything keyed on the round is
   * keyed on a number that changes twice per round.
   */
  outcomeSeq: number;
  myChoice: Choice | null;
  lockedCount: number;
  myLockIndex: number;
  deadline: number;
  timedOut: boolean;
};

export function useGame() {
  const [deck, setDeck] = useState(() => dealDeck(ROUNDS));
  const [players, setPlayers] = useState(makePlayers);
  const [round, setRound] = useState(1);
  const [phase, setPhase] = useState<Phase>("choosing");
  const [outcome, setOutcome] = useState<RoundOutcome | null>(null);
  const [outcomeSeq, setOutcomeSeq] = useState(0);
  const [myChoice, setMyChoice] = useState<Choice | null>(null);
  const [lockedCount, setLockedCount] = useState(0);
  const [myLockIndex, setMyLockIndex] = useState(-1);
  const [deadline, setDeadline] = useState(() => performance.now() + TIME_LIMIT * 1000);
  const [timedOut, setTimedOut] = useState(false);
  const [stake, setStake] = useState(ALLIN_STAKE);
  const [useBoost, setUseBoost] = useState(false);

  const timers = useRef<number[]>([]);
  const botLockAt = useRef<number[]>([]);
  const settled = useRef(false);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  const kind = roundKind(round);
  const dilemma = deck[(round - 1) % deck.length];

  /** Bots commit at their own pace; the pips are the only tell. */
  const startRound = useCallback((botCount: number) => {
    const now = performance.now();
    setDeadline(now + TIME_LIMIT * 1000);
    botLockAt.current = Array.from({ length: botCount }, () =>
      now + (1 + Math.random() * (TIME_LIMIT - 2.4)) * 1000
    ).sort((a, b) => a - b);
    setLockedCount(0);
    setMyLockIndex(-1);
    setMyChoice(null);
    setTimedOut(false);
    setUseBoost(false);          // spending is a per-round decision
    setOutcome(null);
    settled.current = false;
    setPhase("choosing");
  }, []);

  useEffect(() => {
    startRound(players.length - 1);
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);

  const settle = useCallback(
    (choice: Choice, viaTimeout: boolean) => {
      if (settled.current) return;
      settled.current = true;

      const botChoices = collectBotChoices(players, dilemma, kind);
      const choices: Record<number, Choice> = { ...botChoices, 0: choice };
      // bots bet the default share; only the player picks one
      const boosts = { ...collectBotBoosts(players, kind), 0: useBoost };
      const result = resolveRound(players, choices, kind, { 0: stake }, boosts);

      setMyChoice(choice);
      setTimedOut(viaTimeout);
      setLockedCount(players.length);
      setOutcome(result);
      setOutcomeSeq((n) => n + 1);
      setPhase("reveal");
      play("stamp");
      buzz("reveal");

      later(() => {
        setPhase("moving");
        setPlayers((prev) => applyOutcome(prev, result));
        const mine = result.moves.find((m) => m.playerId === 0);
        if (result.moves.some((m) => m.boosterFired)) { play("flame"); buzz("booster"); }
        else if (mine && mine.to > mine.from) { play("dash"); buzz("dash"); }
        else { play("slump"); buzz("miss"); }
      }, REVEAL_MS);

      later(() => {
        // Decided from the outcome, not by peeking at state inside an updater:
        // setState inside another setState's updater is a side effect in a
        // place React is entitled to call twice.
        const finished = result.moves.some((m) => m.to >= CELLS);
        if (finished || round >= ROUNDS) {
          setPhase("done");
          play("finish");
          buzz("finish");
        } else {
          setRound((r) => r + 1);
        }
      }, REVEAL_MS + MOVING_MS);
    },
    [players, dilemma, kind, round, stake, useBoost]
  );

  /** Pips light as bots commit; the clock running out picks for you. */
  useEffect(() => {
    if (phase !== "choosing") return;
    let raf = 0;
    let lastTick = -1;
    const tick = () => {
      const now = performance.now();
      const remain = (deadline - now) / 1000;
      const whole = Math.ceil(remain);
      if (whole <= 3 && whole >= 1 && whole !== lastTick) {
        lastTick = whole;
        play("tick");
      }
      const lit = botLockAt.current.filter((t) => now >= t).length;
      setLockedCount((c) => (lit > c ? lit : c));
      if (now >= deadline) {
        settle(Math.random() < 0.5 ? "a" : "b", true);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, deadline, settle]);

  const pick = useCallback(
    (choice: Choice) => {
      if (phase !== "choosing" || settled.current) return;
      play("click");
      buzz("pick");
      setMyLockIndex(lockedCount);
      settle(choice, false);
    },
    [phase, lockedCount, settle]
  );

  const restart = useCallback(() => {
    clearTimers();
    setDeck(dealDeck(ROUNDS));
    setPlayers(makePlayers());
    setRound(1);
    setStake(ALLIN_STAKE);
    startRound(7);
  }, [startRound]);

  return {
    players, meId: 0, round, kind, dilemma, phase, outcome, outcomeSeq, myChoice,
    lockedCount, myLockIndex, deadline, timedOut,
    winner: phase === "done" ? ranked(players)[0] : null,
    stake, setStake,
    useBoost, setUseBoost,
    pick, restart, canRestart: true,
  };
}
