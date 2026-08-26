import type { Screen } from "../App";
import "./TitleScreen.css";

const MENU: { key: Screen; label: string; hint: string }[] = [
  { key: "solo", label: "혼자 하기", hint: "봇 7명과 대결" },
  { key: "host", label: "방 만들기", hint: "친구를 코드로 초대" },
  { key: "join", label: "참가하기", hint: "6자리 코드 입력" },
];

export default function TitleScreen({ onPick }: { onPick: (s: Screen) => void }) {
  return (
    <div className="title">
      <div className="title-mark">
        <span className="title-eyebrow">눈치게임 레이스</span>
        <h1>
          결정 장애
          <br />
          레이스
        </h1>
        <p>다수와 같은 선택을 하면 전진한다.</p>
      </div>

      <nav className="title-menu">
        {MENU.map((m) => (
          <button key={m.key} className="title-btn" onClick={() => onPick(m.key)}>
            <span className="title-btn-label">{m.label}</span>
            <span className="title-btn-hint">{m.hint}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
