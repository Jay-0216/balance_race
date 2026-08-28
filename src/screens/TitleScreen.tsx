import type { Screen } from "../App";
import TrackPreview from "../ui/TrackPreview";
import "./TitleScreen.css";

const MENU: { key: Screen; label: string; hint: string }[] = [
  { key: "solo", label: "혼자 하기", hint: "봇 7명과 12라운드" },
  { key: "host", label: "방 만들기", hint: "친구를 코드로 초대" },
  { key: "join", label: "참가하기", hint: "6자리 코드 입력" },
  { key: "how", label: "게임 방법", hint: "규칙을 처음부터" },
  { key: "cards", label: "카드 만들기", hint: "밸런스 게임을 직접 낸다" },
  { key: "login", label: "계정", hint: "이름 바꾸기 · 로그인" },
  { key: "feedback", label: "버그 제보", hint: "이상한 걸 봤다면" },
  { key: "proto", label: "레이스 프로토타입", hint: "시각화만 따로 보기" },
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

      <TrackPreview />

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
