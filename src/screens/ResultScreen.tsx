import { CELLS, placements } from "../game/rules";
import type { Player } from "../game/types";
import "./ResultScreen.css";

export default function ResultScreen({
  players,
  onAgain,
  onBack,
}: {
  players: Player[];
  onAgain: () => void;
  onBack: () => void;
}) {
  const order = placements(players);
  const mine = order.find((r) => !r.player.isBot);
  // Everyone who finished on the top cell - usually one, sometimes not. The
  // race can genuinely end level: the clock runs out on round 12 with two
  // players on the same cell, or two of them cross the line in the same
  // round. Picking a "winner" out of those by seat order is inventing a
  // result the game did not produce.
  const champions = order.filter((r) => r.place === 1);
  const tiedTop = champions.length > 1;

  return (
    <div className="result" role="dialog" aria-label="결과">
      {/* Your own placing lands like the round stamp does, because it is the
          one number on this screen you actually came for. It stays put
          instead of fading: the round stamp is a beat, this is the verdict. */}
      {mine && (
        <div
          className={"result-stamp" + (mine.place === 1 ? " win" : "") + (mine.shared ? " shared" : "")}
          aria-hidden="true"
        >
          {mine.shared && <i>공동</i>}
          <b>{mine.place}</b>
          <span>등</span>
        </div>
      )}

      <div className="result-card">
        <span className="result-eyebrow">결승</span>
        <h2 className="result-winner">
          {tiedTop ? (
            <>
              <span className="result-dots">
                {champions.map((r) => (
                  <span key={r.player.id} className="result-dot" style={{ background: r.player.color }} />
                ))}
              </span>
              공동 우승
            </>
          ) : (
            <>
              <span className="result-dot" style={{ background: champions[0].player.color }} />
              {champions[0].player.name}
            </>
          )}
        </h2>
        <p className="result-sub">
          {tiedTop
            ? `${champions.map((r) => r.player.name).join(" · ")} — ${champions[0].player.pos}/${CELLS}칸으로 동률`
            : `${champions[0].player.pos}/${CELLS}칸으로 우승`}
          {mine && ` · 나는 ${mine.shared ? "공동 " : ""}${mine.place}등 (${mine.player.pos}칸)`}
        </p>

        <ol className="result-list">
          {order.map((r) => (
            <li key={r.player.id} className={r.player.isBot ? "" : "me"}>
              <span className={"result-rank" + (r.shared ? " shared" : "")}>{r.place}</span>
              <span className="result-name">
                <span className="result-dot sm" style={{ background: r.player.color }} />
                {r.player.name}
              </span>
              <span className="result-bar">
                <span style={{ width: `${(r.player.pos / CELLS) * 100}%`, background: r.player.color }} />
              </span>
              <span className="result-pos">{r.player.pos}</span>
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
