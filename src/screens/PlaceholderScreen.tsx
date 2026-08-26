import type { Screen } from "../App";
import "./PlaceholderScreen.css";

/**
 * Phase 0 ships the frame, not the game. Each route says which phase
 * fills it in so the shell is never mistaken for a broken build.
 */
type Pending = Exclude<Screen, "title" | "solo">;

const PENDING: Record<Pending, { title: string; phase: string }> = {
  host: { title: "방 만들기", phase: "Phase 4 — 온라인 멀티" },
  join: { title: "참가하기", phase: "Phase 4 — 온라인 멀티" },
};

export default function PlaceholderScreen({
  screen,
  onBack,
}: {
  screen: Pending;
  onBack: () => void;
}) {
  const { title, phase } = PENDING[screen];

  return (
    <div className="ph">
      <header className="ph-bar">
        <button className="ph-back" onClick={onBack} aria-label="뒤로">
          ←
        </button>
        <span>{title}</span>
      </header>

      <div className="ph-body">
        <p className="ph-phase">{phase}</p>
        <p className="ph-note">아직 만들지 않았습니다.</p>
      </div>
    </div>
  );
}
