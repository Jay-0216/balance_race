/**
 * Catching the browser's install offer before anything is mounted to ask for
 * it.
 *
 * `beforeinstallprompt` fires once, early, and only if Chrome has already
 * decided the page qualifies (served over https, a manifest, a controlling
 * service worker, icons at the right sizes - all of which main.tsx and the
 * manifest added in Phase 5 provide). If nothing is listening yet when it
 * fires, the browser does not fire it again on request - so the listener
 * lives at module scope, attached the moment this file is first imported,
 * not inside a component that might mount a beat too late.
 *
 * iOS Safari has no such event and never will; it only knows Share ->
 * "홈 화면에 추가". Nothing here can detect that moment, so the iOS button
 * shows a fixed instruction instead of a working prompt.
 */

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferred: InstallEvent | null = null;
let installed = isStandalone();
const watchers = new Set<() => void>();

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS's own flag for "opened from a home-screen icon", not a media query
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function notify() {
  for (const fn of watchers) fn();
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();          // stop Chrome's own mini-infobar; this button is the UI now
    deferred = e as InstallEvent;
    notify();
  });
  // fires on Android after the app is actually installed, and on desktop too
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installed = true;
    notify();
  });
}

export function isIos() {
  return typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function canPrompt() {
  return !!deferred;
}

export function isInstalled() {
  return installed;
}

export function onInstallChange(fn: () => void) {
  watchers.add(fn);
  return () => {
    watchers.delete(fn);
  };
}

/** Shows Chrome's own install dialog. Resolves once the person has answered. */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  await deferred.prompt();
  const { outcome } = await deferred.userChoice;
  deferred = null;          // an event can only ever be used once
  notify();
  return outcome === "accepted";
}
