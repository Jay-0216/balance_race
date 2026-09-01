import type { Dilemma } from "../game/types";
import { currentSession } from "./auth";
import { getIdentity } from "./identity";
import { isOnlineAvailable, supabase } from "./supabase";

/**
 * The three things players can send back: a bug report, a balance card, and
 * a vote on someone else's.
 *
 * The report is write-only - `feedback` has no select policy at all, so it is
 * readable only in the dashboard. A card is readable to everyone once it is
 * approved, and readable while pending too (see migrations/0010) so it can be
 * voted on; a rejected one goes back to being invisible to anyone but its
 * author. Neither path can be used to read anything a player should not see.
 */

export type FeedbackKind = "bug" | "idea";

/**
 * Same identity for a submission and every vote it casts: the account id if
 * signed in, else this browser's local id.
 *
 * This is not a security boundary - a script could mint fresh local ids all
 * day - it is a courtesy key, same tier of trust as the bolts economy's
 * client-merged stats. What it actually buys is a DB-enforced "one vote per
 * key per card" and a way for `vote_card` to refuse voting on your own.
 */
async function voterKey(): Promise<string> {
  const session = await currentSession();
  return session ? "u:" + session.user.id : "d:" + getIdentity().id;
}

/**
 * No contact field.
 *
 * It asked a middle-schooler for a way to reach them and then filed it into a
 * table nobody reads back to them - so it collected personal data it could not
 * use for the thing it implied. The column is left in the schema (dropping it
 * would throw away reports already filed) and simply never written again.
 */
export async function sendFeedback(input: {
  kind: FeedbackKind;
  body: string;
}) {
  const session = await currentSession();
  const { error } = await supabase().from("feedback").insert({
    user_id: session?.user.id ?? null,
    kind: input.kind,
    body: input.body.trim(),
    // Enough to reproduce it without asking a follow-up question.
    context: {
      ua: navigator.userAgent.slice(0, 200),
      screen: `${window.innerWidth}x${window.innerHeight}`,
      at: new Date().toISOString(),
    },
  });
  if (error) throw error;
}

export async function submitCard(input: {
  category: string;
  aEmoji: string;
  aText: string;
  bEmoji: string;
  bText: string;
  author?: string;
}) {
  const session = await currentSession();
  const { error } = await supabase().from("card_submissions").insert({
    user_id: session?.user.id ?? null,
    submitter_key: await voterKey(),
    author: input.author?.trim() || null,
    category: input.category.trim(),
    a_emoji: input.aEmoji.trim() || "🅰️",
    a_text: input.aText.trim(),
    b_emoji: input.bEmoji.trim() || "🅱️",
    b_text: input.bText.trim(),
  });
  if (error) throw error;
}

type CardRow = {
  id: string;
  category: string;
  a_emoji: string;
  a_text: string;
  b_emoji: string;
  b_text: string;
};

/**
 * Approved player cards, folded into the deck alongside the built-in ones.
 *
 * Never blocks and never throws: if this comes back empty - offline, no keys,
 * nothing approved yet - the game deals from the bundled deck exactly as it
 * did before. A dilemma nobody wrote is better than a game that will not start.
 */
export async function fetchApprovedCards(): Promise<Dilemma[]> {
  if (!isOnlineAvailable()) return [];
  try {
    const { data, error } = await supabase()
      .from("card_submissions")
      .select("id, category, a_emoji, a_text, b_emoji, b_text")
      .eq("status", "approved")
      .limit(200);
    if (error || !data) return [];
    return (data as CardRow[]).map((r) => ({
      id: "u-" + r.id.slice(0, 8),
      category: r.category,
      a: { text: r.a_text, emoji: r.a_emoji },
      b: { text: r.b_text, emoji: r.b_emoji },
      // Nobody has played it yet, so the bots have no crowd to read. A even
      // split is the honest prior; the built-in cards carry measured values.
      popularBias: 0.5,
    }));
  } catch {
    return [];
  }
}

export type PendingCard = {
  id: string;
  category: string;
  aEmoji: string;
  aText: string;
  bEmoji: string;
  bText: string;
  author: string | null;
  up: number;
  down: number;
  /** this device's own vote on it, or null if it hasn't voted yet */
  mine: 1 | -1 | null;
};

type PendingRow = {
  id: string;
  category: string;
  a_emoji: string;
  a_text: string;
  b_emoji: string;
  b_text: string;
  author: string | null;
  submitter_key: string | null;
};

type VoteCountRow = { submission_id: string; up: number; down: number; mine: 1 | -1 | null };

/**
 * Pending cards open for a vote, minus this device's own.
 *
 * The "minus own" filter runs client-side rather than as a `.neq` in the
 * query: a card submitted before this feature shipped has no submitter_key
 * at all, and Postgres's `<> null` is neither true nor false - a `.neq`
 * filter would have quietly dropped every one of those rows from the list
 * forever, not just hidden the author's own. `vote_card` still refuses a
 * self-vote server-side wherever submitter_key is actually set; this filter
 * is only about not showing you a "vote" button on your own card.
 */
export async function fetchPendingCards(): Promise<PendingCard[]> {
  if (!isOnlineAvailable()) return [];
  try {
    const key = await voterKey();
    const sb = supabase();
    const { data, error } = await sb
      .from("card_submissions")
      .select("id, category, a_emoji, a_text, b_emoji, b_text, author, submitter_key")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(50);
    if (error || !data) return [];
    const rows = (data as PendingRow[]).filter((r) => r.submitter_key !== key).slice(0, 30);
    if (rows.length === 0) return [];

    const { data: counts } = await sb.rpc("card_vote_counts", {
      p_ids: rows.map((r) => r.id),
      p_voter_key: key,
    });
    const byId = new Map((counts as VoteCountRow[] | null ?? []).map((c) => [c.submission_id, c]));

    return rows.map((r) => {
      const c = byId.get(r.id);
      return {
        id: r.id,
        category: r.category,
        aEmoji: r.a_emoji,
        aText: r.a_text,
        bEmoji: r.b_emoji,
        bText: r.b_text,
        author: r.author,
        up: c?.up ?? 0,
        down: c?.down ?? 0,
        mine: c?.mine ?? null,
      };
    });
  } catch {
    return [];
  }
}

/** The card's new status and tallies, so the UI can react without a refetch. */
export async function voteCard(
  id: string,
  value: 1 | -1,
): Promise<{ status: "pending" | "approved" | "rejected"; up: number; down: number }> {
  const key = await voterKey();
  const { data, error } = await supabase().rpc("vote_card", {
    p_submission_id: id,
    p_voter_key: key,
    p_value: value,
  });
  if (error) throw error;
  const row = data?.[0] as { status: string; up: number; down: number } | undefined;
  if (!row) throw new Error("no response");
  return row as { status: "pending" | "approved" | "rejected"; up: number; down: number };
}
