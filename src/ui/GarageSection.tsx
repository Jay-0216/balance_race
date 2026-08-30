import { useState } from "react";
import {
  equipPaint, equipPiece, isOwned, loadGarage, ownsPaint, PIECES,
  type GarageState,
} from "../game/garage";
import { COIN, COIN_ICON, PAINTS, PIECE_PRICES, paintHex } from "../game/shop";
import Piece from "../race/Racer";
import type { PieceId } from "../race/pieces";
import "./GarageSection.css";

/**
 * The garage, inside the account page.
 *
 * It was a row in the main menu, which put "what am I driving" on the same
 * shelf as "play a game" - and the menu was eight rows deep and starting to
 * clip. Everything that is *mine* now lives in one place: my face, my name,
 * my piece, my paint, my 볼트.
 *
 * This is the wardrobe, not the shop. Only things you already own appear
 * here; buying is a different screen, because choosing and spending are
 * different decisions and mixing them makes a menu you cannot skim.
 */
export default function GarageSection({
  onShop,
  signedIn,
}: {
  onShop: () => void;
  /** whether this garage is backed by an account or only by this browser */
  signedIn?: boolean;
}) {
  const [garage, setGarage] = useState<GarageState>(loadGarage);
  const synced = signedIn
    ? "이 차고는 계정에 저장된다. 다른 기기에서 로그인해도 그대로 따라온다."
    : "이 차고는 이 브라우저에만 있다. 로그인하면 계정에 저장돼서 안 날아간다.";

  const mine = PIECES.filter((p) => isOwned(p.id, garage));
  const locked = PIECES.filter((p) => !isOwned(p.id, garage));
  const paints = PAINTS.filter((p) => ownsPaint(p.id, garage));
  const hex = paintHex(garage.paint);
  const lean = leanStat(garage.stats);

  const pick = (id: PieceId) => setGarage(equipPiece(id));

  return (
    <section className="gr">
      <div className="gr-head">
        <h3>차고</h3>
        <span className="gr-purse">{COIN_ICON} {garage.bolts.toLocaleString()}</span>
      </div>
      <p className="gr-sub">
        경주차일 필요는 없다. 판 위의 말이라고 생각하면 된다. · {mine.length}/{PIECES.length}
      </p>

      <ul className="gr-grid">
        {mine.map((p) => (
          <li key={p.id}>
            <button
              className={"gr-card" + (garage.equipped === p.id ? " on" : "")}
              onClick={() => pick(p.id)}
              aria-pressed={garage.equipped === p.id}
            >
              <svg className="gr-art" viewBox="-20 -14 40 28" aria-hidden="true">
                {/* nose to the right, the way it runs on the track */}
                <Piece piece={p.id} color={hex} />
              </svg>
              <b className="gr-name">{p.name}</b>
              <span className="gr-blurb">{p.blurb}</span>
              {garage.equipped === p.id && <span className="gr-on">타는 중</span>}
            </button>
          </li>
        ))}
      </ul>

      {paints.length > 1 && (
        <>
          <h4 className="gr-mini">페인트</h4>
          <div className="gr-paints" role="group" aria-label="페인트">
            {paints.map((p) => (
              <button
                key={p.id}
                className={"gr-paint" + (garage.paint === p.id ? " on" : "")}
                style={{ background: p.hex }}
                onClick={() => setGarage(equipPaint(p.id))}
                aria-pressed={garage.paint === p.id}
                aria-label={p.name}
                title={p.name}
              />
            ))}
          </div>
        </>
      )}

      {/* Locked pieces are named but not shown off: the shop is where they are
          sold, and a wardrobe that keeps advertising is a shop in disguise. */}
      {locked.length > 0 && (
        <p className="gr-locked">
          아직 없는 말 {locked.length}개 —{" "}
          {locked.map((p) => (p.unlock ? `${p.name}(${p.unlock.label})` : `${p.name}(${PIECE_PRICES[p.id]}${COIN})`)).join(", ")}
        </p>
      )}

      <div className="form-actions">
        <button className="btn-quiet" onClick={onShop}>상점 열기</button>
      </div>

      <p className="gr-sync">{synced}</p>

      {/* The one line the whole game is actually about: not "wins" but "did
          you read the room". Held back until there is enough of a sample to
          say something true - one round decided is 0% or 100%, and neither
          number means anything yet. */}
      {lean && (
        <p className="gr-lean">
          <b>{lean.majority ? "다수파" : "소수파"} {lean.pct}%</b>
          <span>{lean.rounds}라운드 중 {lean.majority ? "다수" : "소수"}를 골랐다</span>
        </p>
      )}

      <p className="gr-stats">
        {garage.stats.games}판 · {garage.stats.wins}승
        {garage.stats.quizPlays > 0 && ` · 퀴즈 최고 ${garage.stats.quizBest}개`}
        {garage.earned > 0 && ` · 지금까지 ${garage.earned.toLocaleString()}${COIN} 벌었다`}
      </p>
    </section>
  );
}

/** null until there have been enough non-tie rounds for a percentage to mean
 *  anything - a single round decided is 0% or 100%, neither of them real. */
function leanStat(stats: { readRounds: number; majorityRounds: number }) {
  if (stats.readRounds < 8) return null;
  const majorityPct = Math.round((stats.majorityRounds / stats.readRounds) * 100);
  const majority = majorityPct >= 50;
  return { majority, pct: majority ? majorityPct : 100 - majorityPct, rounds: stats.readRounds };
}
