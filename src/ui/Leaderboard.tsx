import { useLayoutEffect, useRef } from "react";
import { ranked } from "../game/rules";
import type { Player } from "../game/types";
import "./Leaderboard.css";

/**
 * Rows animate to their new rank with FLIP: measure where each row was, let
 * React reorder, then transform each row back to its old spot and release it.
 * Without this the standings just teleport, and the one moment the player most
 * wants to follow - who passed whom - is the one they cannot see.
 */
export default function Leaderboard({
  players,
  cells,
}: {
  players: Player[];
  cells: number;
}) {
  const rowsRef = useRef(new Map<number, HTMLLIElement>());
  // the board is two columns, so a rank change can move a row sideways as well
  const prevBoxes = useRef(new Map<number, { x: number; y: number }>());

  const order = ranked(players);

  useLayoutEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const next = new Map<number, { x: number; y: number }>();

    rowsRef.current.forEach((el, id) => {
      const box = el.getBoundingClientRect();
      const now = { x: box.left, y: box.top };
      next.set(id, now);

      const before = prevBoxes.current.get(id);
      if (reduce || !before) return;
      const dx = before.x - now.x;
      const dy = before.y - now.y;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;

      el.style.transition = "none";
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      requestAnimationFrame(() => {
        el.style.transition = "transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)";
        el.style.transform = "";
      });
    });

    prevBoxes.current = next;
  }, [order]);

  return (
    <ol className="board">
      {order.map((p, i) => (
        <li
          key={p.id}
          ref={(el) => {
            if (el) rowsRef.current.set(p.id, el);
            else rowsRef.current.delete(p.id);
          }}
          className={"board-row" + (p.isBot ? "" : " me")}
        >
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
