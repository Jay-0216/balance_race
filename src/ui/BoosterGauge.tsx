import { BOOSTER_CHARGE_MAX, BOOSTER_MULTIPLIER, isArmed } from "../game/rules";
import "./BoosterGauge.css";

const R = 22;
const CIRC = 2 * Math.PI * R;

/** classic bolt, centred in the 52-unit button box */
const BOLT = "13 2 4 14 11 14 10 22 19 10 12 10";

/**
 * The charge is drawn as a ring around the button it unlocks, so the thing
 * filling up and the thing you press are one object. Nothing ever fires on its
 * own: a full ring only means the button has become pressable.
 *
 * Ready and on used to differ by a border tint and a slightly larger icon,
 * which is not a difference you can see mid-round. They are now outline vs
 * filled - the oldest unambiguous pair of states there is - and the label says
 * 꺼짐 / 켜짐 outright rather than leaving it to be inferred.
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
          full
            ? armed ? "부스터 끄기" : "부스터 켜기"
            : `부스터 충전 ${charge}/${BOOSTER_CHARGE_MAX}`
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
          <polygon className="boost-bolt" points={BOLT} transform="translate(12.2 12.2) scale(1.15)" />
        </svg>
      </button>

      <span className="boost-text">
        <b>
          {armed ? "부스터 켜짐" : full ? "부스터 꺼짐" : `충전 ${charge} / ${BOOSTER_CHARGE_MAX}`}
        </b>
        <span>
          {armed
            ? `다수면 ${BOOSTER_MULTIPLIER}배 · 소수면 충전이 날아간다 · 다시 누르면 끈다`
            : full
              ? "누르면 이번 라운드에 쓴다"
              : "소수를 고르면 충전된다"}
        </span>
      </span>
    </div>
  );
}
