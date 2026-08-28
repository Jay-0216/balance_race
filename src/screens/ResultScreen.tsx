import { CELLS, ranked } from "../game/rules";
import type { Player } from "../game/types";
import "./ResultScreen.css";

export default function ResultScreen({
  players,
  winner,
  onAgain,
  onBack,
}: {
  players: Player[];
  winner: Player;
  onAgain: () => void;
  onBack: () => void;
}) {
  const order = ranked(players);
  const me = players.find((p) => !p.isBot);
  const myRank = order.findIndex((p) => !p.isBot) + 1;

  return (
    <div className="result" role="dialog" aria-label="결과">
      {/* Your own placing lands like the round stamp does, because it is the
          one number on this screen you actually came for. It stays put
          instead of fading: the round stamp is a beat, this is the verdict. */}
      <div className={"result-stamp" + (myRank === 1 ? " win" : "")} aria-hidden="true">
        <b>{myRank}</b>
        <span>등</span>
      </div>

      <div className="result-card">
        <span className="result-eyebrow">결승</span>
        <h2 className="result-winner">
          <span className="result-dot" style={{ background: winner.color }} />
          {winner.name}
        </h2>
        <p className="result-sub">
          {winner.pos}/{CELLS}칸으로 우승
          {me && ` · 나는 ${myRank}등 (${me.pos}칸)`}
        </p>

        <ol className="result-list">
          {order.map((p, i) => (
            <li key={p.id} className={p.isBot ? "" : "me"}>
              <span className="result-rank">{i + 1}</span>
              <span className="result-name">
                <span className="result-dot sm" style={{ background: p.color }} />
                {p.name}
              </span>
              <span className="result-bar">
                <span style={{ width: `${(p.pos / CELLS) * 100}%`, background: p.color }} />
              </span>
              <span className="result-pos">{p.pos}</span>
            </li>
          ))}
        </ol>

        <div className="result-actions">
          <button className="result-again" onClick={onAgain}>한 판 더</button>
          <button className="result-out" onClick={onBack}>나가기</button>
        </div>
      </div>
    </div>
  );
}
