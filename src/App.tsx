import { useEffect, useState } from "react";
import { addApprovedCards } from "./game/setup";
import { activeCode } from "./net/live";
import { pullAndMerge, startGarageSync } from "./net/garageSync";
import { fetchApprovedCards } from "./net/submissions";
import Stage from "./ui/Stage";
import TitleScreen from "./screens/TitleScreen";
import GameScreen from "./screens/GameScreen";
import CardSubmitScreen from "./screens/CardSubmitScreen";
import HowToScreen from "./screens/HowToScreen";
import LoginScreen from "./screens/LoginScreen";
import LiveHostScreen from "./screens/LiveHostScreen";
import ShopScreen from "./screens/ShopScreen";
import LivePlayScreen from "./screens/LivePlayScreen";
import QuizScreen from "./screens/QuizScreen";
import RaceScreen from "./screens/RaceScreen";

export type Screen =
  | "title" | "solo" | "quiz" | "shop" | "proto" | "join"
  | "live" | "how" | "cards" | "login";

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
  // Player-written cards are fetched once, in the background. Nothing waits on
  // it: a deck without them is the deck the game has always had.
  useEffect(() => {
    void fetchApprovedCards().then(addApprovedCards);
  }, []);

  // The garage follows the account. Nothing waits on it: the local save is
  // what the game reads, and this only reconciles it with the profile row.
  useEffect(() => {
    void pullAndMerge();
    return startGarageSync();
  }, []);

  /**
   * A host who reloads mid-session comes back to the session.
   *
   * The resume logic itself lives in the live screen, which was useless on its
   * own: after a reload the app opens on the title, so that screen was never
   * mounted to run it. Twenty people waiting on a host whose phone locked is
   * exactly the case this has to survive, so the decision is made here, before
   * anything renders.
   */
  const [screen, setScreen] = useState<Screen>(() => (activeCode() ? "live" : "title"));
  /**
   * A live session the player is joining. There is one code box, not two: the
   * code you were handed is just a code, and having to know in advance whether
   * it belongs to a race or to a live session is a question only the app can
   * answer, so the app answers it.
   */
  const [liveCode, setLiveCode] = useState<string | null>(null);
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
      ) : screen === "join" || liveCode ? (
        <LivePlayScreen
          code={liveCode}
          onBack={() => { setLiveCode(null); setScreen("title"); }}
        />
      ) : screen === "live" ? (
        <LiveHostScreen onBack={() => setScreen("title")} />
      ) : screen === "quiz" ? (
        <QuizScreen onBack={() => setScreen("title")} />
      ) : screen === "shop" ? (
        <ShopScreen onBack={() => setScreen("login")} />
      ) : screen === "cards" ? (
        <CardSubmitScreen onBack={() => setScreen("title")} />
      ) : screen === "login" ? (
        <LoginScreen onBack={() => setScreen("title")} onShop={() => setScreen("shop")} />
      ) : (
        <RaceScreen onBack={() => setScreen("title")} />
      )}
    </Stage>
  );
}
