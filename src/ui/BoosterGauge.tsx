import { BOOSTER_CHARGE_MAX, isArmed } from "../game/rules";
import "./BoosterGauge.css";

/**
 * The gauge is the whole point of the redesign: charge is visible while it
 * builds, and spending it is a button the player presses on a round they chose.
 */
export default function BoosterGauge({
  charge,
  armed,
  disabled,
  onToggle,
}: {
  charge: number;
  /** the player has armed it for this round */
  armed: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  const full = isArmed(charge);

  return (
    <div className={"boost" + (full ? " full" : "") + (armed ? " armed" : "")}>
      <span className="boost-bars" aria-hidden="true">
        {Array.from({ length: BOOSTER_CHARGE_MAX }, (_, i) => (
          <span key={i} className={"boost-bar" + (i < charge ? " on" : "")} />
        ))}
      </span>

      <button
        className="boost-btn"
        disabled={disabled || !full}
        onClick={onToggle}
        aria-pressed={armed}
      >
        {armed ? "부스터 사용 중" : full ? "부스터 사용" : `충전 ${charge}/${BOOSTER_CHARGE_MAX}`}
      </button>

      <span className="boost-hint">
        {armed
          ? "이 라운드 다수면 2배 · 소수면 충전이 날아간다"
          : full
            ? "쓸 라운드는 직접 고른다"
            : "소수를 고르면 충전된다"}
      </span>
    </div>
  );
}
