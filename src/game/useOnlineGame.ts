import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  closeRound, listPlayers, lockedCount, mySeat, nextRound, playersFromRoster,
  readRoom, watchRoom, type RoomRow,
} from "../net/rooms";
import { ALLIN_STAKE, CELLS, ranked, roundKind, TIME_LIMIT } from "./rules";
import { replay, type ClosedRound } from "./replay";
import { play } from "../ui/sound";
import type { Choice, Player } from "./types";
import { submitChoice } from "../net/rooms";
import { REVEAL_MS, MOVING_MS, type Phase } from "./useGame";

/** how often we ask how many have committed, while a round is open */
const PIP_MS = 700;

/**
 * The online race, as the same shape the solo game returns - so one screen
 * draws both.
 *
 * Nothing here is authoritative and nothing here waits for a host. The room row
 * says which round is open and when it ends; the choices come back only once a
 * round is closed; everything else - positions, charges, who is winning - is
 * replayed locally from those two facts. Two phones running this land on the
 * same race because resolveRound is pure and the randomness is seeded.
 */
export function useOnlineGame(code: string) {
  const [room, setRoom] = useState<RoomRow | null>(null);
  const [closed, setClosed] = useState<Record<number, ClosedRound>>({});
  const [shown, setShown] = useState(1);
  const [phase, setPhase] = useState<Phase>("choosing");
  const [outcomeSeq, setOutcomeSeq] = useState(0);
  const [myChoice, setMyChoice] = useState<Choice | null>(null);
  const [locked, setLocked] = useState(0);
  const [myLockIndex, setMyLockIndex] = useState(-1);
  const [timedOut, setTimedOut] = useState(false);
  /**
   * The reveal animation has finished playing.
   *
   * Without this the phase sat at "moving" forever after the first round: the
   * round-change effect refuses to jump while an animation is running, and
   * nothing ever said the animation was over - so the room advanced underneath
   * a screen frozen on round one.
   */
  const [animDone, setAnimDone] = useState(false);
  const [stake, setStake] = useState(ALLIN_STAKE);
  const [useBoost, setUseBoost] = useState(false);

  const meId = mySeat(code)?.seat ?? 0;
  const timers = useRef<number[]>([]);
  const closing = useRef(false);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  useEffect(() => watchRoom(code, setRoom), [code]);

  const roster = room?.roster ?? [];
  const deck = room?.deck ?? [];
  const humans = roster.filter((s) => !s.bot).length;

  // Every round before the one being asked is closed by definition, so a
  // player who reloads - or who opens the room three rounds late - catches up
  // by simply asking for them.
  useEffect(() => {
    if (!room || room.status === "lobby") return;
    const upto = room.status === "done" ? deck.length : room.round;
    let alive = true;
    void (async () => {
      for (let r = 1; r <= upto; r++) {
        if (closed[r] || (r === room.round && room.status !== "done")) continue;
        try {
          const got = await closeRound(code, r);
          if (!alive) return;
          setClosed((prev) => (prev[r] ? prev : { ...prev, [r]: got }));
        } catch {
          break;                     // not closed yet; the clock will get it
        }
      }
    })();
    return () => { alive = false; };
  }, [code, room, deck.length, closed]);

  const rep = useMemo(
    () => replay(code, roster, deck, closed, playersFromRoster),
    [code, roster, deck, closed]
  );

  const step = rep.steps.find((s) => s.round === shown);
  const moving = phase === "moving" || phase === "done";
  const players: Player[] = step ? (moving ? step.after : step.before) : rep.players;
  const outcome = phase === "reveal" || phase === "moving" ? step?.outcome ?? null : null;

  const deadline = useMemo(() => {
    if (!room?.round_ends_at) return performance.now() + TIME_LIMIT * 1000;
    // the server's clock, expressed in this browser's monotonic one
    return performance.now() + (new Date(room.round_ends_at).getTime() - Date.now());
  }, [room?.round_ends_at]);

  /** A new round from the server resets everything that is per-round. */
  useEffect(() => {
    if (!room || room.status !== "playing") return;
    if (room.round === shown) return;
    // never cut an animation short, but never outlive it either
    if ((phase === "reveal" || phase === "moving") && !animDone) return;
    setShown(room.round);
    setPhase("choosing");
    setAnimDone(false);
    setMyChoice(null);
    setMyLockIndex(-1);
    setLocked(0);
    setTimedOut(false);
    setUseBoost(false);
    closing.current = false;
  }, [room, shown, phase, animDone]);

  /** The pips, and the moment the round is actually over. */
  useEffect(() => {
    if (!room || room.status !== "playing" || phase !== "choosing" || shown !== room.round) return;
    let alive = true;

    const settle = async () => {
      if (closing.current) return;
      closing.current = true;
      try {
        const got = await closeRound(code, shown);
        if (!alive) return;
        setClosed((prev) => ({ ...prev, [shown]: got }));
        setTimedOut(!got[meId]);
        setPhase("reveal");
        setOutcomeSeq((n) => n + 1);
        play("stamp");

        later(() => {
          setPhase("moving");
          play("dash");
        }, REVEAL_MS);

        // Whoever finishes the animation first moves the room on; the rest
        // no-op. That is the whole of "no host required".
        later(() => {
          setAnimDone(true);
          void nextRound(code, shown)
            .then(() => readRoom(code))
            .then((r) => { if (alive && r) setRoom(r); })
            .catch(() => {});
        }, REVEAL_MS + MOVING_MS);
      } catch {
        closing.current = false;      // still open; try again on the next tick
      }
    };

    const tick = async () => {
      try {
        const n = await lockedCount(code, shown);
        if (!alive) return;
        setLocked(n);
        if (n >= humans || Date.now() >= new Date(room.round_ends_at ?? 0).getTime()) {
          await settle();
        }
      } catch { /* one dropped tick is not worth a message */ }
    };

    void tick();
    const id = window.setInterval(tick, PIP_MS);
    return () => { alive = false; window.clearInterval(id); };
  }, [code, room, phase, shown, humans, meId]);

  /**
   * The room being over is the server's word, not a guess from positions.
   *
   * The last round is the one case where the room's round never changes again,
   * so this has to wait for the animation on its own rather than relying on
   * the round-change effect to notice.
   */
  useEffect(() => {
    if (room?.status !== "done") return;
    if ((phase === "reveal" || phase === "moving") && !animDone) return;
    setPhase("done");
  }, [room?.status, phase, animDone]);

  const pick = useCallback(
    (choice: Choice) => {
      if (phase !== "choosing" || myChoice) return;
      play("click");
      setMyChoice(choice);            // optimistic: the tap has to feel instant
      setMyLockIndex(locked);
      void submitChoice(code, shown, choice, useBoost, stake).catch(() => {
        setMyChoice(null);
        setMyLockIndex(-1);
      });
    },
    [code, phase, myChoice, locked, shown, useBoost, stake]
  );

  const finished = rep.players.some((p) => p.pos >= CELLS);

  return {
    players,
    meId,
    round: shown,
    kind: roundKind(shown),
    dilemma: deck[shown - 1] ?? deck[0],
    phase: finished && phase === "done" ? "done" : phase,
    outcome,
    outcomeSeq,
    myChoice,
    lockedCount: locked,
    myLockIndex,
    deadline,
    timedOut,
    winner: phase === "done" ? ranked(rep.players)[0] ?? null : null,
    stake, setStake,
    useBoost, setUseBoost,
    pick,
    /** online rooms do not restart; leaving is the only way out */
    restart: () => {},
    canRestart: false,
    ready: !!room && room.status !== "lobby" && deck.length > 0,
    room,
    refreshPlayers: () => listPlayers(code),
  };
}
