import { CELLS, placements } from "../game/rules";
import { COIN, COIN_ICON } from "../game/shop";
import type { Player } from "../game/types";
import "./ResultScreen.css";

export default function ResultScreen({
  players,
  meId = 0,
  unlocked = [],
  prize = 0,
  onAgain,
  onBack,
}: {
  players: Player[];
  /** which seat is mine - online, "not a bot" is most of the table */
  meId?: number;
  /** names of pieces this game earned, if any */
  unlocked?: string[];
  /** 볼트 won by this race */
  prize?: number;
  /** absent in an online room, which cannot be replayed on the spot */
  onAgain?: () => void;
  onBack: () => void;
}) {
  const order = placements(players);
  const mine = order.find((r) => r.player.id === meId);
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
            <li key={r.player.id} className={r.player.id === meId ? "me" : ""}>
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

        {prize > 0 && (
          <p className="result-prize">
            {COIN_ICON} <b>+{prize.toLocaleString()}</b> {COIN}
          </p>
        )}

        {unlocked.length > 0 && (
          <p className="unlock-note">🔓 차고에 새 말이 들어왔다 — {unlocked.join(", ")}</p>
        )}

        <div className="result-actions">
          {onAgain && <button className="result-again" onClick={onAgain}>한 판 더</button>}
          <button className="result-out" onClick={onBack}>
            {onAgain ? "나가기" : "방에서 나가기"}
          </button>
        </div>
      </div>
    </div>
  );
}
