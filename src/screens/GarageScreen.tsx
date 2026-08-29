import { useState } from "react";
import {
  equipPiece, isOwned, loadGarage, PIECES, type GarageState,
} from "../game/garage";
import Piece from "../race/Racer";
import type { PieceId } from "../race/pieces";
import "./GarageScreen.css";

/**
 * The garage.
 *
 * Pieces are not cars and the screen says so: they are what you move round
 * the board. Locked ones are shown, not hidden - a locked piece you can see
 * is a reason to play another round, and a locked piece you cannot see is
 * nothing at all. Its silhouette shows through so you know what you are
 * playing for, but drained of colour so there is no mistaking it for owned.
 */
export default function GarageScreen({ onBack }: { onBack: () => void }) {
  const [garage, setGarage] = useState<GarageState>(loadGarage);
  const owned = PIECES.filter((p) => isOwned(p.id, garage.stats)).length;

  const pick = (id: PieceId) => {
    if (!isOwned(id, garage.stats)) return;
    setGarage(equipPiece(id));
  };

  return (
    <div className="form-screen">
      <header className="form-head">
        <button className="form-back" onClick={onBack} aria-label="뒤로">←</button>
        <div className="form-title">
          <span className="form-eyebrow">차고</span>
          <h2>뭘 타고 달릴까</h2>
          <p>경주차일 필요는 없다. 판 위의 말이라고 생각하면 된다. · {owned}/{PIECES.length}</p>
        </div>
      </header>

      <div className="form-body">
        <ul className="gr-grid">
          {PIECES.map((p) => {
            const has = isOwned(p.id, garage.stats);
            const on = garage.equipped === p.id;
            return (
              <li key={p.id}>
                <button
                  className={"gr-card" + (on ? " on" : "") + (has ? "" : " locked")}
                  onClick={() => pick(p.id)}
                  disabled={!has}
                  aria-pressed={on}
                >
                  <svg className="gr-art" viewBox="-20 -14 40 28" aria-hidden="true">
                    {/* nose to the right, the way it runs on the track */}
                    <Piece piece={p.id} color={has ? "#f0b429" : "#55666f"} />
                  </svg>
                  <b className="gr-name">{p.name}</b>
                  <span className="gr-blurb">{has ? p.blurb : p.unlock?.label}</span>
                  {on && <span className="gr-on">타는 중</span>}
                  {!has && <span className="gr-lock" aria-label="잠김">🔒</span>}
                </button>
              </li>
            );
          })}
        </ul>

        <p className="gr-stats">
          {garage.stats.games}판 · {garage.stats.wins}승
          {garage.stats.quizPlays > 0 && ` · 퀴즈 최고 ${garage.stats.quizBest}개`}
        </p>
      </div>
    </div>
  );
}
