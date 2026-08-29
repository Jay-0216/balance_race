import { useEffect, useState } from "react";
import type { Screen } from "../App";
import Avatar from "../ui/Avatar";
import TrackPreview from "../ui/TrackPreview";
import { getIdentity, type Identity } from "../net/identity";
import "./TitleScreen.css";

const MENU: { key: Screen; label: string; hint: string }[] = [
  { key: "solo", label: "혼자 하기", hint: "봇 7명과 12라운드" },
  { key: "quiz", label: "퀴즈 혼자 풀기", hint: "10문제, 내 기록 재기" },
  { key: "live", label: "라이브 만들기", hint: "코드로 초대 · 인원 무제한" },
  { key: "room", label: "같이 레이스", hint: "친구 최대 8명 · 빈자리는 봇" },
  { key: "join", label: "참가하기", hint: "받은 코드로 들어가기" },
  { key: "cards", label: "카드 만들기", hint: "밸런스 게임을 직접 낸다" },
  { key: "proto", label: "레이스 미리보기", hint: "트랙만 따로 보기" },
];

export default function TitleScreen({ onPick }: { onPick: (s: Screen) => void }) {
  // Re-read on mount rather than at module load: coming back from the account
  // screen with a new nickname has to change the face in the corner.
  const [me, setMe] = useState<Identity>(getIdentity);
  useEffect(() => setMe(getIdentity()), []);

  return (
    <div className="title">
      {/* The account lives in the corner, as a face, the way every app puts it.
          A row in the menu made it look like a mode you could play. */}
      <button className="title-account" onClick={() => onPick("login")} aria-label="계정">
        <Avatar id={me.id} nickname={me.nickname} look={me.look} photo={me.photo} size={38} />
      </button>

      <div className="title-mark">
        <span className="title-eyebrow">눈치게임 레이스</span>
        <h1>
          <span className="title-name">
            밸런스
            <br />
            레이스
          </span>
          {/* Attached to the name, because "what is this game" is a question
              you ask about the name - not an eighth thing to play. */}
          <button
            className="title-help"
            onClick={() => onPick("how")}
            aria-label="게임 방법"
            title="게임 방법"
          >
            ?
          </button>
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

      {/* Whose game this is. Opens in its own tab: a game that navigates you
          away mid-session and loses your garage is a rude credit. */}
      <a
        className="title-by"
        href="http://jay-0216.kro.kr/"
        target="_blank"
        rel="noopener noreferrer"
      >
        Made by Jay-0216
      </a>
    </div>
  );
}
