import { useCallback, useMemo, useState } from "react";
import { useGame } from "../game/useGame";
import { CELLS, KIND_LABEL, ROUNDS, TIME_LIMIT } from "../game/rules";
import RaceView from "../race/RaceView";
import type { RacerView } from "../race/world";
import DilemmaCard from "../ui/DilemmaCard";
import Leaderboard from "../ui/Leaderboard";
import LockPips from "../ui/LockPips";
import TallyBar from "../ui/TallyBar";
import Timer from "../ui/Timer";
import ResultScreen from "./ResultScreen";
import "./GameScreen.css";

export default function GameScreen({ onBack }: { onBack: () => void }) {
  const g = useGame();
  const [fps, setFps] = useState(0);
  const onFps = useCallback((v: number) => setFps(v), []);

  const racers: RacerView[] = useMemo(
    () => g.players.map((p) => ({
      id: p.id, name: p.name, color: p.color, me: !p.isBot, pos: p.pos,
    })),
    [g.players]
  );

  const kindLabel = KIND_LABEL[g.kind];
  const revealing = g.phase === "reveal" || g.phase === "moving";

  return (
    <div className="game">
      <header className="game-bar">
        <button className="game-back" onClick={onBack} aria-label="나가기">←</button>
        <span className="game-round">
          ROUND {Math.min(g.round, ROUNDS)} / {ROUNDS}
        </span>
        <span className="game-fps">{fps} fps</span>
      </header>

      <div className="game-stage">
        <RaceView racers={racers} onFps={onFps} />
        <div className="game-hud">
          <Timer
            endAt={g.deadline}
            limit={TIME_LIMIT}
            running={g.phase === "choosing"}
            locked={g.myChoice !== null}
          />
        </div>
        {kindLabel && <div className={"game-kind " + g.kind}>{kindLabel}</div>}
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
          dilemma={g.dilemma}
          disabled={g.phase !== "choosing"}
          picked={g.myChoice}
          onPick={g.pick}
        />

        <TallyBar
          countA={g.outcome?.countA ?? 0}
          countB={g.outcome?.countB ?? 0}
          show={revealing}
        />

        <p className="game-note">{revealing ? <RoundNote g={g} /> : " "}</p>

        <Leaderboard players={g.players} cells={CELLS} />
      </div>

      {g.phase === "done" && g.winner && (
        <ResultScreen
          players={g.players}
          winner={g.winner}
          onAgain={g.restart}
          onBack={onBack}
        />
      )}
    </div>
  );
}

function RoundNote({ g }: { g: ReturnType<typeof useGame> }) {
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
  const gained = o.moves.filter((m) => m.boosterGained);
  const name = (id: number) => g.players.find((p) => p.id === id)?.name ?? "";

  if (fired.length) parts.push(`⚡ 부스터 — ${fired.map((m) => name(m.playerId)).join(", ")}`);
  if (gained.length) parts.push(`극소수 ${gained.map((m) => name(m.playerId)).join(", ")} 부스터 획득`);

  return <>{parts.join("  ·  ")}</>;
}
