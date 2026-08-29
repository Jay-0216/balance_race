import { useOnlineGame } from "../game/useOnlineGame";
import GameScreen from "./GameScreen";

/**
 * The same race, replayed from a room.
 *
 * There is a moment before the first room row arrives where there is no deck
 * and no roster, and drawing a game from nothing would flash an empty track -
 * so it waits, which is honest and takes about as long as a page load.
 */
export default function RoomScreen({ code, onBack }: { code: string; onBack: () => void }) {
  const g = useOnlineGame(code);

  if (!g.ready) {
    return (
      <div className="form-screen">
        <header className="form-head">
          <button className="form-back" onClick={onBack} aria-label="나가기">←</button>
          <div className="form-title">
            <span className="form-eyebrow">{code}</span>
            <h2>불러오는 중…</h2>
          </div>
        </header>
      </div>
    );
  }
  return <GameScreen game={g} onBack={onBack} />;
}
