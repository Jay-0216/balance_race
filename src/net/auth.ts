import type { Session } from "@supabase/supabase-js";
import { cleanPhoto, type Look } from "./identity";
import { isOnlineAvailable, supabase } from "./supabase";

/**
 * Accounts, kept deliberately thin.
 *
 * Signing in is optional and always will be: the game has to work with no
 * network and no account, so this module's job is to *upgrade* an identity,
 * never to gate one. Everything here returns quietly when Supabase is not
 * configured rather than throwing at a call site that has no way to recover.
 *
 * Email magic link is the only method wired up because it is the only one that
 * needs no dashboard configuration - no OAuth app, no client secret. Anonymous
 * sign-in would be nicer for a first launch, but it has to be switched on in
 * Auth -> Providers first, so it stays a later step rather than a broken
 * button today.
 */

export type Account = {
  userId: string;
  email: string | null;
  nickname: string;
  /** the chosen face, or null for the one derived from the id */
  look: Look | null;
  /** an uploaded picture as a small data URL, readable only by this account */
  photo: string | null;
};

/** Where the magic link comes back to. Must match Supabase's allow-list. */
export function redirectTo() {
  if (typeof window === "undefined") return undefined;
  return window.location.origin + import.meta.env.BASE_URL;
}

export async function currentSession(): Promise<Session | null> {
  if (!isOnlineAvailable()) return null;
  const { data } = await supabase().auth.getSession();
  return data.session ?? null;
}

/** Fetches (and creates on first sight) the profile row for a session. */
export async function loadAccount(session: Session): Promise<Account> {
  const sb = supabase();
  const fallback = session.user.email?.split("@")[0]?.slice(0, 8) || "나";

  const { data } = await sb
    .from("profiles")
    .select("nickname, avatar_emoji, avatar_hue, avatar_photo")
    .eq("id", session.user.id)
    .maybeSingle();

  if (data) {
    return {
      userId: session.user.id,
      email: session.user.email ?? null,
      nickname: data.nickname,
      // Half a face is no face: an emoji with no hue (or the other way round)
      // means the row predates the columns, so fall back to the derived one.
      look:
        data.avatar_emoji && data.avatar_hue !== null
          ? { emoji: data.avatar_emoji, hue: data.avatar_hue }
          : null,
      // whatever is in the row has to clear the same shape check as anything
      // out of localStorage before it becomes an <img> src
      photo: cleanPhoto(data.avatar_photo),
    };
  }

  await sb.from("profiles").insert({ id: session.user.id, nickname: fallback });
  return {
    userId: session.user.id,
    email: session.user.email ?? null,
    nickname: fallback,
    look: null,
    photo: null,
  };
}

export async function savePhoto(userId: string, photo: string | null) {
  if (!isOnlineAvailable()) return;
  await supabase().from("profiles").update({ avatar_photo: photo }).eq("id", userId);
}

/** Clearing it (null) is a real choice, so both columns go back to null. */
export async function saveLook(userId: string, look: Look | null) {
  if (!isOnlineAvailable()) return;
  await supabase()
    .from("profiles")
    .update({ avatar_emoji: look?.emoji ?? null, avatar_hue: look?.hue ?? null })
    .eq("id", userId);
}

export async function saveNickname(userId: string, nickname: string) {
  if (!isOnlineAvailable()) return;
  await supabase().from("profiles").update({ nickname }).eq("id", userId);
}

/**
 * Sends the link. Supabase's built-in mailer is rate limited (a couple an
 * hour), so a failure here is usually "you just asked", not "it is broken" -
 * the caller shows the message rather than swallowing it.
 */
export async function sendMagicLink(email: string) {
  const { error } = await supabase().auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo() },
  });
  if (error) throw error;
}

export async function signOut() {
  if (!isOnlineAvailable()) return;
  await supabase().auth.signOut();
}

export function onAuthChange(fn: (session: Session | null) => void) {
  if (!isOnlineAvailable()) return () => {};
  const { data } = supabase().auth.onAuthStateChange((_e, session) => fn(session));
  return () => data.subscription.unsubscribe();
}
