import type { Choice, Dilemma } from "../game/types";
import "./DilemmaCard.css";

/**
 * The two options are flung in from opposite edges, collide in the middle,
 * and shove each other back into place; VS pops out of the impact and settles
 * where they met. Remount the component (key on the round) to replay it.
 */
export default function DilemmaCard({
  dilemma,
  disabled,
  picked,
  over,
  onPick,
}: {
  dilemma: Dilemma;
  disabled: boolean;
  picked: Choice | null;
  /** the game is finished - there is no choice left, so no VS either */
  over?: boolean;
  onPick: (c: Choice) => void;
}) {
  return (
    <div className="choices">
      {(["a", "b"] as Choice[]).map((side) => {
        const opt = dilemma[side];
        return (
          <button
            key={side}
            className={"choice" + (picked === side ? " picked" : "")}
            data-side={side}
            disabled={disabled}
            onClick={() => onPick(side)}
          >
            <span className="choice-tag">{side.toUpperCase()}</span>
            <span className="choice-emoji">{opt.emoji}</span>
            <span className="choice-text">{opt.text}</span>
          </button>
        );
      })}
      {/* The result overlay is translucent, and gold VS punched straight
          through it - a versus badge on top of the final standings. */}
      {!over && <span className="vs" aria-hidden="true">VS</span>}
    </div>
  );
}
