import { useCallback, useEffect, useRef, useState } from "react";
import { collectBotChoices } from "./bots";
import {
  applyOutcome, CELLS, ranked, resolveRound, roundKind, ROUNDS, TIME_LIMIT,
} from "./rules";
import { dealDeck, makePlayers } from "./setup";
import type { Choice, Dilemma, Player, RoundOutcome } from "./types";

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

export type GameState = {
  players: Player[];
  round: number;
  dilemma: Dilemma;
  phase: Phase;
  outcome: RoundOutcome | null;
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
  const [myChoice, setMyChoice] = useState<Choice | null>(null);
  const [lockedCount, setLockedCount] = useState(0);
  const [myLockIndex, setMyLockIndex] = useState(-1);
  const [deadline, setDeadline] = useState(() => performance.now() + TIME_LIMIT * 1000);
  const [timedOut, setTimedOut] = useState(false);

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
      const result = resolveRound(players, choices, kind);

      setMyChoice(choice);
      setTimedOut(viaTimeout);
      setLockedCount(players.length);
      setOutcome(result);
      setPhase("reveal");

      later(() => {
        setPhase("moving");
        setPlayers((prev) => applyOutcome(prev, result));
      }, REVEAL_MS);

      later(() => {
        setPlayers((prev) => {
          const finished = prev.some((p) => p.pos >= CELLS);
          if (finished || round >= ROUNDS) {
            setPhase("done");
          } else {
            setRound((r) => r + 1);
          }
          return prev;
        });
      }, REVEAL_MS + MOVING_MS);
    },
    [players, dilemma, kind, round]
  );

  /** Pips light as bots commit; the clock running out picks for you. */
  useEffect(() => {
    if (phase !== "choosing") return;
    let raf = 0;
    const tick = () => {
      const now = performance.now();
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
    startRound(7);
  }, [startRound]);

  return {
    players, round, kind, dilemma, phase, outcome, myChoice,
    lockedCount, myLockIndex, deadline, timedOut,
    winner: phase === "done" ? ranked(players)[0] : null,
    pick, restart,
  };
}
