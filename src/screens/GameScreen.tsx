import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GameLike } from "../game/useGame";
import { CELLS, KIND_LABEL, placements, ROUNDS, sideStory, TIME_LIMIT } from "../game/rules";
import { equippedPiece, PIECES, recordBoost, recordRace } from "../game/garage";
import type { PieceId } from "../race/pieces";
import RaceView from "../race/RaceView";
import type { RaceEffect } from "../race/effects";
import type { RacerView } from "../race/world";
import BoosterGauge from "../ui/BoosterGauge";
import DilemmaCard from "../ui/DilemmaCard";
import Leaderboard from "../ui/Leaderboard";
import LockPips from "../ui/LockPips";
import RoundAlert from "../ui/RoundAlert";
import Score from "../ui/Score";
import TallyBar from "../ui/TallyBar";
import { buzzOn, canBuzz, setBuzz } from "../ui/haptics";
import { isMuted, setMuted } from "../ui/sound";
import Stamp, { type StampKind } from "../ui/Stamp";
import StakePicker from "../ui/StakePicker";
import Timer from "../ui/Timer";
import ResultScreen from "./ResultScreen";
import "./GameScreen.css";

/**
 * One screen, two games.
 *
 * Solo and online hand in the same shape (GameLike), so nothing below knows or
 * cares which it is drawing. The only thing that used to assume solo was
 * `players[0]` meaning "me" - online that is whoever holds seat 0, which is
 * usually somebody else.
 */
export default function GameScreen({ game, onBack }: { game: GameLike; onBack: () => void }) {
  const g = game;
  const [fps, setFps] = useState(0);
  // read once: swapping pieces mid-race is not a thing, and re-reading every
  // render would put a localStorage hit in the frame loop's way
  const [myPiece] = useState<PieceId>(equippedPiece);
  const [unlocked, setUnlocked] = useState<string[]>([]);
  const [prize, setPrize] = useState(0);
  const [muted, setMutedState] = useState(isMuted);
  const [buzzing, setBuzzing] = useState(buzzOn);
  const onFps = useCallback((v: number) => setFps(v), []);

  // the stage jolts on the stamp, not the page - jolting the chrome of a phone
  // game reads as a bug rather than a hit
  const stageRef = useRef<HTMLDivElement>(null);
  const stamp: StampKind = g.outcome ? sideStory(g.outcome, g.myChoice) : null;

  useEffect(() => {
    if (g.phase !== "reveal" || !stageRef.current) return;
    const el = stageRef.current;
    el.classList.remove("shake");
    void el.offsetWidth;
    el.classList.add("shake");
  }, [g.phase, g.round]);

  // A special round is announced with a hit, and a hit that only moves the
  // text is not a hit - the stage takes it too.
  useEffect(() => {
    if (g.kind === "normal" || !stageRef.current) return;
    const el = stageRef.current;
    el.classList.remove("kapow");
    void el.offsetWidth;
    el.classList.add("kapow");
    // Taken off again once it has played: two classes on one element both
    // declaring `animation` means the loser never runs, and the reveal shake
    // would silently stop working on exactly the rounds that matter most.
    const id = window.setTimeout(() => el.classList.remove("kapow"), 500);
    return () => clearTimeout(id);
  }, [g.kind, g.round]);

  // Winners get a gust, booster holders get a flare, keyed so the race view
  // plays each exactly once.
  //
  // The key used to be the round number, which fired every gust twice: the
  // round counter increments while the phase is still "moving" and the old
  // outcome is still on screen, so the same eight moves came back under new
  // keys ~1.7s later - a second gust behind cars that had already stopped.
  // outcomeSeq changes once per resolution and nowhere else.
  const effects: RaceEffect[] = useMemo(() => {
    // only once the cars actually dash - fired at reveal they were over
    // before anyone had moved
    if (!g.outcome || g.phase !== "moving") return [];
    return g.outcome.moves
      .filter((m) => m.to > m.from)
      .map((m) => ({
        key: g.outcomeSeq * 100 + m.playerId,
        playerId: m.playerId,
        kind: m.boosterFired ? ("booster" as const) : ("advance" as const),
      }));
  }, [g.outcome, g.phase, g.outcomeSeq]);

  // Only I get my piece. Eight assorted shapes would be a zoo and my own
  // would stop standing out - which is the one thing the piece is for.
  const racers: RacerView[] = useMemo(
    () => g.players.map((p) => ({
      // the paint is already on the player: makePlayers() reads it, so the
      // leaderboard dot and the piece on the track cannot disagree
      id: p.id, name: p.name, color: p.color, me: p.id === g.meId, pos: p.pos,
      piece: p.id === g.meId ? myPiece : undefined,
    })),
    [g.players, myPiece, g.meId]
  );

  // Spending a booster counts the moment it fires: a game you walk out of
  // still contained the round where you spent one.
  const boostSeen = useRef(0);
  useEffect(() => {
    if (!g.outcome || g.outcomeSeq === boostSeen.current) return;
    boostSeen.current = g.outcomeSeq;
    if (g.outcome.moves.some((m) => m.playerId === 0 && m.boosterFired)) {
      // recorded here, not inside the updater below: a state updater must be
      // pure, and React is entitled to call it more than once. Under
      // StrictMode it does exactly that, and the garage counted two boosters
      // for one.
      const won = names(recordBoost().unlocked);
      if (won.length) setUnlocked((u) => [...u, ...won]);
    }
  }, [g.outcome, g.outcomeSeq, g.meId]);

  const tallied = useRef(false);
  useEffect(() => {
    if (g.phase !== "done" || tallied.current) return;
    tallied.current = true;
    const board = placements(g.players);
    const mine = board.find((r) => r.player.id === g.meId);
    if (!mine) return;
    const back = Math.min(...g.players.map((p) => p.pos));
    // likewise outside the updater - this one writes the games-played count,
    // and StrictMode was recording every finished race twice
    const reward = recordRace({
      place: mine.place,
      won: mine.place === 1,
      last: mine.player.pos === back,
      finished: mine.player.pos >= CELLS,
    });
    setPrize(reward.bolts);
    const earned = names(reward.unlocked);
    if (earned.length) setUnlocked((u) => [...u, ...earned]);
  }, [g.phase, g.players, g.meId]);

  // a fresh game is a fresh tally
  useEffect(() => {
    if (g.phase === "choosing" && g.round === 1) {
      tallied.current = false;
      setUnlocked([]);
      setPrize(0);
    }
  }, [g.phase, g.round]);

  const me = g.players.find((p) => p.id === g.meId);
  const kindLabel = KIND_LABEL[g.kind];
  const revealing = g.phase === "reveal" || g.phase === "moving";

  return (
    <div className="game">
      <header className="game-bar">
        <button className="game-back" onClick={onBack} aria-label="나가기">←</button>
        <span className="game-round">
          ROUND {Math.min(g.round, ROUNDS)} / {ROUNDS}
        </span>
        <button
          className="game-mute"
          onClick={() => { const next = !muted; setMuted(next); setMutedState(next); }}
          aria-label={muted ? "소리 켜기" : "소리 끄기"}
          title={muted ? "소리 켜기" : "소리 끄기"}
        >
          {muted ? "🔇" : "🔊"}
        </button>
        {/* only where it can do something: iOS ignores vibrate entirely, and a
            dead toggle is worse than no toggle */}
        {canBuzz() && (
          <button
            className="game-mute"
            onClick={() => { const next = !buzzing; setBuzz(next); setBuzzing(next); }}
            aria-label={buzzing ? "진동 끄기" : "진동 켜기"}
            title={buzzing ? "진동 끄기" : "진동 켜기"}
          >
            {buzzing ? "📳" : "📴"}
          </button>
        )}
        <span className="game-fps">{fps} fps</span>
      </header>

      <div className="game-stage" ref={stageRef}>
        <RaceView
          racers={racers}
          effects={effects}
          paused={g.phase === "done"}
          onFps={onFps}
        />
        <div className="game-hud">
          <Timer
            endAt={g.deadline}
            limit={TIME_LIMIT}
            running={g.phase === "choosing"}
            locked={g.myChoice !== null}
          />
        </div>
        {kindLabel && (
          <div key={g.round} className={"game-kind " + g.kind}>{kindLabel}</div>
        )}
        {/* and gone entirely once the game is over: the result screen states
            the same number, in more detail, right next to it */}
        {g.phase !== "done" && <Score pos={me?.pos ?? 0} cells={CELLS} />}
        <Stamp kind={g.phase === "reveal" ? stamp : null} at={g.round} />
        <RoundAlert kind={g.kind} round={g.round} />
      </div>

      <div className="game-panel">
        <div className="game-deck-top">
          <span className="game-cat">{g.dilemma.category}</span>
          <LockPips
            total={g.players.length}
            locked={g.lockedCount}
            mineIndex={g.myLockIndex}
          />
        </div>

        <DilemmaCard
          key={g.dilemma.id + g.round}
          dilemma={g.dilemma}
          disabled={g.phase !== "choosing"}
          picked={g.myChoice}
          over={g.phase === "done"}
          onPick={g.pick}
        />

        <BoosterGauge
          charge={me?.charge ?? 0}
          armed={g.useBoost}
          disabled={g.phase !== "choosing"}
          onToggle={() => g.setUseBoost(!g.useBoost)}
        />

        {g.kind === "allin" && (
          <StakePicker
            pos={me?.pos ?? 0}
            share={g.stake}
            disabled={g.phase !== "choosing"}
            onChange={g.setStake}
          />
        )}

        <TallyBar
          countA={g.outcome?.countA ?? 0}
          countB={g.outcome?.countB ?? 0}
          show={revealing}
        />

        <p className="game-note">{revealing ? <RoundNote g={g} /> : " "}</p>

        <Leaderboard players={g.players} cells={CELLS} />
      </div>

      {g.phase === "done" && (
        <ResultScreen
          players={g.players}
          meId={g.meId}
          unlocked={unlocked}
          prize={prize}
          onAgain={g.canRestart ? g.restart : undefined}
          onBack={onBack}
        />
      )}
    </div>
  );
}

/** piece ids -> the names a player would recognise */
function names(ids: PieceId[]) {
  return ids.map((id) => PIECES.find((p) => p.id === id)?.name ?? id);
}

function RoundNote({ g }: { g: GameLike }) {
  const o = g.outcome;
  if (!o) return null;

  const parts: string[] = [];
  if (g.timedOut) parts.push("시간 초과 — 자동 선택");

  if (o.tie) {
    parts.push("동점 — 아무도 못 읽었다 · 전원 +1칸");
  } else {
    const pct = Math.round(o.majorityShare * 100);
    const side = o.advancingSide === "a" ? "A" : "B";
    parts.push(
      o.kind === "reverse"
        ? `역전! 소수 ${side}쪽 +${o.gain}칸`
        : `${side}쪽 ${pct}% · +${o.gain}칸`
    );
  }

  const fired = o.moves.filter((m) => m.boosterFired);
  const gained = o.moves.filter((m) => m.chargeGained > 0);
  const name = (id: number) => g.players.find((p) => p.id === id)?.name ?? "";

  if (fired.length) parts.push(`⚡ 부스터 — ${fired.map((m) => name(m.playerId)).join(", ")}`);
  if (gained.length) parts.push(`소수 ${gained.map((m) => name(m.playerId)).join(", ")} 충전`);

  return <>{parts.join("  ·  ")}</>;
}
