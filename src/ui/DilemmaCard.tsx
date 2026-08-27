import type { Choice, Dilemma } from "../game/types";
import "./DilemmaCard.css";

export default function DilemmaCard({
  dilemma,
  disabled,
  picked,
  onPick,
}: {
  dilemma: Dilemma;
  disabled: boolean;
  picked: Choice | null;
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
    </div>
  );
}
