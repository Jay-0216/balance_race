import { useState } from "react";
import {
  buy, isOwned, loadGarage, ownsGear, ownsPaint, paintKey, PIECES, pieceKey,
  type GarageState,
} from "../game/garage";
import { COIN, COIN_ICON, GEAR, PAINTS, PIECE_PRICES } from "../game/shop";
import Piece from "../race/Racer";
import { play } from "../ui/sound";
import "../ui/Form.css";
import "../ui/GarageSection.css";
import "./ShopScreen.css";

type Tab = "piece" | "paint" | "gear";

/**
 * The shop.
 *
 * Separate from the garage on purpose: choosing what to drive and deciding
 * what to spend on are different decisions, and a single list that does both
 * is one you stop reading. Everything here has a price; everything you
 * already own is over there.
 *
 * Pieces with an unlock condition are not sold. Getting the turtle for coming
 * last is a joke about how you played, and a joke you can buy is not a joke.
 */
export default function ShopScreen({ onBack }: { onBack: () => void }) {
  const [garage, setGarage] = useState<GarageState>(loadGarage);
  const [tab, setTab] = useState<Tab>("piece");
  const [msg, setMsg] = useState<string | null>(null);

  const purchase = (id: string, price: number, name: string) => {
    const res = buy(id, price);
    setGarage(res.state);
    if (res.bought) {
      play("stamp");
      setMsg(`${name} 샀다. 차고에서 바꿔 낄 수 있다.`);
    } else {
      setMsg(`${COIN_ICON} ${(price - garage.bolts).toLocaleString()}${COIN} 더 있어야 한다.`);
    }
  };

  const forSale = PIECES.filter((p) => !p.unlock && PIECE_PRICES[p.id] !== undefined);

  return (
    <div className="form-screen">
      <header className="form-head">
        <button className="form-back" onClick={onBack} aria-label="뒤로">←</button>
        <div className="form-title">
          <span className="form-eyebrow">상점</span>
          <h2>{COIN_ICON} {garage.bolts.toLocaleString()}{COIN}</h2>
          <p>이기면 {COIN}를 번다. 1등 300, 완주 +100, 퀴즈는 한 문제에 25.</p>
        </div>
      </header>

      <div className="form-body">
        <div className="seg sh-tabs">
          {([["piece", "말"], ["paint", "페인트"], ["gear", "장비"]] as const).map(([k, label]) => (
            <button key={k} aria-pressed={tab === k} onClick={() => setTab(k)}>{label}</button>
          ))}
        </div>

        {tab === "piece" && (
          <ul className="gr-grid">
            {forSale.map((p) => {
              const price = PIECE_PRICES[p.id]!;
              const had = isOwned(p.id, garage);
              return (
                <li key={p.id}>
                  <button
                    className={"gr-card" + (had ? " on" : "")}
                    onClick={() => !had && purchase(pieceKey(p.id), price, p.name)}
                    disabled={had}
                  >
                    <svg className="gr-art" viewBox="-20 -14 40 28" aria-hidden="true">
                      <Piece piece={p.id} color={had ? "#f0b429" : "#8a9aa4"} />
                    </svg>
                    <b className="gr-name">{p.name}</b>
                    <span className="gr-blurb">{p.blurb}</span>
                    <span className={"sh-price" + (had ? " had" : "")}>
                      {had ? "가지고 있음" : `${COIN_ICON} ${price}`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {tab === "paint" && (
          <ul className="sh-paints">
            {PAINTS.filter((p) => p.price > 0).map((p) => {
              const had = ownsPaint(p.id, garage);
              return (
                <li key={p.id}>
                  <button
                    className={"sh-paint" + (had ? " had" : "")}
                    onClick={() => !had && purchase(paintKey(p.id), p.price, p.name)}
                    disabled={had}
                  >
                    {/* the paint on the piece you actually race, not a swatch:
                        a circle of colour tells you nothing about how it looks
                        at 30px on a road */}
                    <svg className="sh-swatch" viewBox="-18 -12 36 24" aria-hidden="true">
                      <Piece piece={garage.equipped} color={p.hex} />
                    </svg>
                    <b>{p.name}</b>
                    <span className={"sh-price" + (had ? " had" : "")}>
                      {had ? "가지고 있음" : `${COIN_ICON} ${p.price}`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {tab === "gear" && (
          <ul className="sh-gear">
            {GEAR.map((g) => {
              const had = ownsGear(g.id, garage);
              return (
                <li key={g.id}>
                  <button
                    className={"sh-gear-card" + (had ? " had" : "")}
                    onClick={() => !had && purchase(g.id, g.price, g.name)}
                    disabled={had}
                  >
                    <b>{g.name}</b>
                    <span>{g.blurb}</span>
                    <span className={"sh-price" + (had ? " had" : "")}>
                      {had ? "가지고 있음" : `${COIN_ICON} ${g.price}`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {msg && <p className="form-msg ok">{msg}</p>}
      </div>
    </div>
  );
}
