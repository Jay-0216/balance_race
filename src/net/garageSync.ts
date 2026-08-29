import { loadGarage, mergeGarage, onGarageChange, parseGarage, putGarage } from "../game/garage";
import { currentSession } from "./auth";
import { isOnlineAvailable, supabase } from "./supabase";

/**
 * The garage on the account.
 *
 * Local storage stays the source everything reads from - the game has to work
 * signed out, and it does. This only mirrors that save to the profile row when
 * there is an account to mirror it to, and merges the two when one shows up.
 *
 * The merge never loses anything (see mergeGarage). What that costs is a rare
 * generosity; what it buys is that signing in on a new phone, or clearing site
 * data, or playing offline for a week, can never take a kid's things away.
 */

let pushing = 0;

/** Pull the account's save, merge it with this device's, keep both. */
export async function pullAndMerge(): Promise<boolean> {
  if (!isOnlineAvailable()) return false;
  const session = await currentSession();
  if (!session) return false;

  const { data, error } = await supabase()
    .from("profiles")
    .select("garage")
    .eq("id", session.user.id)
    .maybeSingle();
  if (error) return false;

  const cloud = parseGarage(data?.garage);
  const local = loadGarage();
  const merged = cloud ? mergeGarage(local, cloud) : local;
  putGarage(merged);

  // First sign-in has no cloud row: this is what carries a guest's garage up
  // rather than replacing it with an empty one.
  await push(session.user.id, merged);
  return true;
}

async function push(userId: string, state: unknown) {
  try {
    await supabase().from("profiles").update({ garage: state }).eq("id", userId);
  } catch {
    // an offline save is not lost, only late: the next change pushes again
  }
}

/**
 * Mirror every change up, but not every keystroke's worth of them.
 *
 * Equipping a paint writes the garage; so does buying, winning and finishing a
 * quiz. A round of the shop is a handful of writes in a few seconds, and they
 * are all the same row - so they are collapsed into one request.
 */
export function startGarageSync() {
  if (!isOnlineAvailable()) return () => {};
  return onGarageChange(() => {
    window.clearTimeout(pushing);
    pushing = window.setTimeout(() => {
      void currentSession().then((s) => {
        if (s) void push(s.user.id, loadGarage());
      });
    }, 1500);
  });
}
