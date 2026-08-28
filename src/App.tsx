import { useEffect, useState } from "react";
import Stage from "./ui/Stage";
import TitleScreen from "./screens/TitleScreen";
import GameScreen from "./screens/GameScreen";
import HowToScreen from "./screens/HowToScreen";
import LobbyScreen from "./screens/LobbyScreen";
import RaceScreen from "./screens/RaceScreen";

export type Screen = "title" | "solo" | "proto" | "host" | "join" | "how";

const SEEN = "ddr.seen-rules";

/** localStorage throws outright in a locked-down browser, so never assume it. */
function seenRules() {
  try {
    return localStorage.getItem(SEEN) === "1";
  } catch {
    return true;          // can't remember? don't nag on every launch
  }
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("title");
  // First visit opens on the rules. A 눈치게임 where you do not know what the
  // majority does is just guessing, so this is not an optional detour.
  const [first, setFirst] = useState(() => !seenRules());

  useEffect(() => {
    if (first) setScreen("how");
  }, [first]);

  const closeRules = () => {
    try {
      localStorage.setItem(SEEN, "1");
    } catch {
      /* private window: the rules simply show again next time */
    }
    setFirst(false);
    setScreen("title");
  };

  return (
    <Stage>
      {screen === "how" ? (
        <HowToScreen first={first} onDone={closeRules} />
      ) : screen === "title" ? (
        <TitleScreen onPick={setScreen} />
      ) : screen === "solo" ? (
        <GameScreen onBack={() => setScreen("title")} />
      ) : screen === "proto" ? (
        <RaceScreen onBack={() => setScreen("title")} />
      ) : (
        <LobbyScreen mode={screen} onBack={() => setScreen("title")} />
      )}
    </Stage>
  );
}
