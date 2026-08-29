import { useGame } from "../game/useGame";
import GameScreen from "./GameScreen";

/** Seven bots and a deck dealt on this device. */
export default function SoloScreen({ onBack }: { onBack: () => void }) {
  return <GameScreen game={useGame()} onBack={onBack} />;
}
