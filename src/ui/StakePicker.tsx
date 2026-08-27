import { ALLIN_MAX, ALLIN_MIN, stakeFor } from "../game/rules";
import "./StakePicker.css";

/**
 * The all-in round asks a second question on top of the dilemma: how much of
 * your lead you are willing to put behind the answer. Shown only on that round.
 */
export default function StakePicker({
  pos,
  share,
  disabled,
  onChange,
}: {
  pos: number;
  share: number;
  disabled: boolean;
  onChange: (share: number) => void;
}) {
  const cells = stakeFor(pos, share);

  return (
    <label className="stake">
      <span className="stake-head">
        <span className="stake-label">베팅</span>
        <span className="stake-value">
          {cells}칸 <span className="stake-pct">({Math.round(share * 100)}%)</span>
        </span>
      </span>
      <input
        type="range"
        min={ALLIN_MIN * 100}
        max={ALLIN_MAX * 100}
        step={5}
        value={Math.round(share * 100)}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        aria-label="베팅할 칸 비율"
      />
      <span className="stake-hint">맞히면 +{cells}칸, 틀리면 −{cells}칸</span>
    </label>
  );
}
