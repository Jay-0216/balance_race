import { useEffect, useState } from "react";
import { KIND_SUB, KIND_TITLE } from "../game/rules";
import type { RoundKind } from "../game/types";
import { buzz } from "./haptics";
import { play } from "./sound";
import "./RoundAlert.css";

const HOLD_MS = 1500;

/**
 * A special round is the whole point of the game - it is the one thing a
 * player has to know before they choose - and it was being announced by a
 * 11.5px chip in the corner, the same size and weight as the frame counter.
 *
 * So the announcement is now a hit: the name lands from three times its size
 * with a shockwave behind it, the stage shakes, and it is over before the
 * clock has spent a second. The corner chip stays afterwards as the reminder,
 * which is a different job and can go back to being small.
 */
export default function RoundAlert({
  kind,
  round,
}: {
  kind: RoundKind;
  /** remount key: one announcement per round, never one per re-render */
  round: number;
}) {
  const [shown, setShown] = useState<{ kind: RoundKind; round: number } | null>(null);

  useEffect(() => {
    if (kind === "normal") return;
    setShown({ kind, round });
    play("alert");
    buzz("alert");
    const id = window.setTimeout(() => setShown(null), HOLD_MS);
    return () => clearTimeout(id);
  }, [kind, round]);

  if (!shown) return null;

  return (
    <div key={shown.round} className={"alert " + shown.kind} role="status">
      <span className="alert-ring" aria-hidden="true" />
      <span className="alert-ring two" aria-hidden="true" />
      <span className="alert-flash" aria-hidden="true" />
      <strong className="alert-title">{KIND_TITLE[shown.kind]}</strong>
      <span className="alert-sub">{KIND_SUB[shown.kind]}</span>
    </div>
  );
}
