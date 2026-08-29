import type { Dilemma } from "../game/types";
import { currentSession } from "./auth";
import { isOnlineAvailable, supabase } from "./supabase";

/**
 * The two things players can send back: a bug report and a balance card.
 *
 * Both are write-only from here. `feedback` has no select policy at all, so a
 * report is readable only in the dashboard; card submissions become readable
 * to everyone the moment they are marked approved by hand, and not before.
 * Neither path can be used to read anything a player should not see.
 */

export type FeedbackKind = "bug" | "idea";

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
