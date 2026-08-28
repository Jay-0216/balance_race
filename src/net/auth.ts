import type { Session } from "@supabase/supabase-js";
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
    .select("nickname")
    .eq("id", session.user.id)
    .maybeSingle();

  if (data) {
    return { userId: session.user.id, email: session.user.email ?? null, nickname: data.nickname };
  }

  await sb.from("profiles").insert({ id: session.user.id, nickname: fallback });
  return { userId: session.user.id, email: session.user.email ?? null, nickname: fallback };
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
