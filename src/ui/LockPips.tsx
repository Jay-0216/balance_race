import "./LockPips.css";

/**
 * One pip per player, filling left to right as people commit. It says HOW MANY
 * have chosen and never WHAT they chose - pressure with no information leak.
 * (These orbited the timer ring at first, which just made it look like a tire.)
 */
export default function LockPips({
  total,
  locked,
  mineIndex,
}: {
  total: number;
  locked: number;
  /** which pip is the player's own, or -1 while they have not committed */
  mineIndex: number;
}) {
  return (
    <span className="locks">
      <span className="pips">
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={"pip" + (i < locked ? " on" : "") + (i === mineIndex ? " mine" : "")}
          />
        ))}
      </span>
      <span className="locks-n">
        {locked} / {total} 선택
      </span>
    </span>
  );
}
