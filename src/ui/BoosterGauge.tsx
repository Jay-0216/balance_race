import { BOOSTER_CHARGE_MAX, BOOSTER_MULTIPLIER, isArmed } from "../game/rules";
import "./BoosterGauge.css";

const R = 22;
const CIRC = 2 * Math.PI * R;

/**
 * The charge is drawn as a ring around the button it unlocks, so the thing
 * filling up and the thing you press are one object. Nothing ever fires on its
 * own: a full ring only means the button has become pressable.
 */
export default function BoosterGauge({
  charge,
  armed,
  disabled,
  onToggle,
}: {
  charge: number;
  /** the player has pressed it for this round */
  armed: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  const full = isArmed(charge);
  const fill = Math.min(1, charge / BOOSTER_CHARGE_MAX);

  return (
    <div className={"boost" + (full ? " full" : "") + (armed ? " armed" : "")}>
      <button
        className="boost-btn"
        disabled={disabled || !full}
        onClick={onToggle}
        aria-pressed={armed}
        aria-label={
          full ? (armed ? "부스터 사용 취소" : "부스터 사용") : `부스터 충전 ${charge}/${BOOSTER_CHARGE_MAX}`
        }
      >
        <svg viewBox="0 0 52 52" aria-hidden="true">
          <circle className="boost-track" cx="26" cy="26" r={R} />
          <circle
            className="boost-fill"
            cx="26" cy="26" r={R}
            strokeDasharray={CIRC}
            strokeDashoffset={CIRC * (1 - fill)}
            transform="rotate(-90 26 26)"
          />
        </svg>
        <span className="boost-icon">⚡</span>
      </button>

      <span className="boost-text">
        <b>
          {armed ? "부스터 켜짐" : full ? "부스터 준비" : `충전 ${charge} / ${BOOSTER_CHARGE_MAX}`}
        </b>
        <span>
          {armed
            ? `이 라운드 다수면 ${BOOSTER_MULTIPLIER}배 · 소수면 충전이 날아간다`
            : full
              ? "버튼을 눌러야 쓴다 — 쓸 라운드는 직접 고른다"
              : "소수를 고르면 충전된다"}
        </span>
      </span>
    </div>
  );
}
