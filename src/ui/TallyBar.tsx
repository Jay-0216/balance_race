import "./TallyBar.css";

export default function TallyBar({
  countA,
  countB,
  show,
}: {
  countA: number;
  countB: number;
  show: boolean;
}) {
  const total = Math.max(1, countA + countB);
  return (
    <div className={"tally" + (show ? " on" : "")}>
      <div className="tally-bar">
        <div className="tally-seg a" style={{ width: show ? `${(countA / total) * 100}%` : 0 }}>
          {show && countA > 0 ? countA : ""}
        </div>
        <div className="tally-seg b" style={{ width: show ? `${(countB / total) * 100}%` : 0 }}>
          {show && countB > 0 ? countB : ""}
        </div>
      </div>
    </div>
  );
}
