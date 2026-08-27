import { useCallback, useState } from "react";
import RaceView from "../race/RaceView";
import { CELLS, makeRacers, type RacerView } from "../race/world";
import "./RaceScreen.css";

/**
 * Phase 1 harness. There is deliberately no game here - no dilemmas, no
 * majority, no timer. The only question this screen answers is whether the
 * race is worth watching, which is the one thing the plan says has to be true
 * before anything else gets built.
 */
export default function RaceScreen({ onBack }: { onBack: () => void }) {
  const [racers, setRacers] = useState<RacerView[]>(makeRacers);
  const [fps, setFps] = useState(0);
  const [round, setRound] = useState(0);

  const advance = () => {
    setRacers((prev) => {
      const movers = new Set<number>();
      const share = 0.35 + Math.random() * 0.4;
      prev.forEach((r) => {
        if (Math.random() < share) movers.add(r.id);
      });
      if (movers.size === 0) movers.add(Math.floor(Math.random() * prev.length));

      return prev.map((r) =>
        movers.has(r.id)
          ? { ...r, pos: Math.min(CELLS, r.pos + 1 + Math.floor(Math.random() * 3)) }
          : r
      );
    });
    setRound((r) => r + 1);
  };

  const reset = () => {
    setRacers(makeRacers());
    setRound(0);
  };

  const ranked = [...racers].sort((a, b) => b.pos - a.pos);
  const done = racers.some((r) => r.pos >= CELLS);

  return (
    <div className="race-screen">
      <header className="rs-bar">
        <button className="rs-back" onClick={onBack} aria-label="뒤로">←</button>
        <span className="rs-title">레이스 프로토타입</span>
        <span className="rs-fps" title="초당 프레임">{fps} fps</span>
      </header>

      <RaceView racers={racers} onFps={useCallback((v: number) => setFps(v), [])} />

      <div className="rs-panel">
        <div className="rs-meta">
          <span className="rs-round">이동 {round}회</span>
          <span className="rs-lead">
            선두 <b>{ranked[0].name}</b> {ranked[0].pos}/{CELLS}
          </span>
        </div>

        <div className="rs-actions">
          <button className="rs-go" onClick={advance} disabled={done}>
            {done ? "결승 통과" : "랜덤 전진"}
          </button>
          <button className="rs-reset" onClick={reset}>리셋</button>
        </div>

        <div className="rs-slot">
          <span>Phase 2 &mdash; 딜레마 카드와 선택지 자리</span>
        </div>

        <ol className="rs-board">
          {ranked.map((r, i) => (
            <li key={r.id} className={"rs-row" + (r.me ? " me" : "")}>
              <span className="rs-rank">{i + 1}</span>
              <span className="rs-dot" style={{ background: r.color }} />
              <span className="rs-name">{r.name}</span>
              <span className="rs-pos">{r.pos}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
