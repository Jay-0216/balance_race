import { ranked } from "../game/rules";
import type { Player } from "../game/types";
import "./Leaderboard.css";

export default function Leaderboard({
  players,
  cells,
}: {
  players: Player[];
  cells: number;
}) {
  return (
    <ol className="board">
      {ranked(players).map((p, i) => (
        <li key={p.id} className={"board-row" + (p.isBot ? "" : " me")}>
          <span className="board-rank">{i + 1}</span>
          <span className="board-dot" style={{ background: p.color }} />
          <span className="board-name">{p.name}</span>
          {p.booster && <span className="board-boost" title="부스터 보유">⚡</span>}
          <span className="board-pos">
            {p.pos}/{cells}
          </span>
        </li>
      ))}
    </ol>
  );
}
