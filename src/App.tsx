import { useState } from "react";
import Stage from "./ui/Stage";
import TitleScreen from "./screens/TitleScreen";
import GameScreen from "./screens/GameScreen";
import LobbyScreen from "./screens/LobbyScreen";
import RaceScreen from "./screens/RaceScreen";

export type Screen = "title" | "solo" | "proto" | "host" | "join";

export default function App() {
  const [screen, setScreen] = useState<Screen>("title");

  return (
    <Stage>
      {screen === "title" ? (
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
