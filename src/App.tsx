import { useState } from "react";
import Stage from "./ui/Stage";
import TitleScreen from "./screens/TitleScreen";
import PlaceholderScreen from "./screens/PlaceholderScreen";

export type Screen = "title" | "solo" | "host" | "join";

export default function App() {
  const [screen, setScreen] = useState<Screen>("title");

  return (
    <Stage>
      {screen === "title" ? (
        <TitleScreen onPick={setScreen} />
      ) : (
        <PlaceholderScreen screen={screen} onBack={() => setScreen("title")} />
      )}
    </Stage>
  );
}
