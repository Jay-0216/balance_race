import { useEffect, useState } from "react";
import {
  canPrompt, isInstalled, isIos, onInstallChange, promptInstall,
} from "./pwaInstall";
import "./InstallButton.css";

/**
 * "앱을 까는 버튼" - so this only ever shows one that does something.
 *
 * Chrome/Android gets a real button wired to the native install prompt.
 * Already-installed hides it outright: an install button inside the app you
 * already installed is a dead end, not a feature. iOS gets a one-line
 * instruction rather than a button, because there is nothing for a button to
 * call - Apple never shipped a JS hook for "add to home screen", only the
 * Share sheet a person has to open themselves.
 */
export default function InstallButton() {
  const [ready, setReady] = useState(canPrompt);
  const [gone, setGone] = useState(isInstalled);
  const [busy, setBusy] = useState(false);

  useEffect(() => onInstallChange(() => {
    setReady(canPrompt());
    setGone(isInstalled());
  }), []);

  if (gone) return null;

  if (isIos()) {
    return (
      <p className="install-hint">
        <span aria-hidden="true">􀈂</span> 공유 버튼 → <b>홈 화면에 추가</b>하면 앱처럼 깔린다.
      </p>
    );
  }

  if (!ready) return null;      // the browser has not offered yet - no dead button

  const install = async () => {
    setBusy(true);
    const accepted = await promptInstall();
    setBusy(false);
    if (accepted) setGone(true);
  };

  return (
    <button className="install-btn" onClick={() => void install()} disabled={busy}>
      <span aria-hidden="true">📲</span> 앱으로 설치하기
    </button>
  );
}
