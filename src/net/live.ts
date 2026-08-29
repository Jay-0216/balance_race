import { getIdentity } from "./identity";
import { makeRoomCode, supabase } from "./supabase";

/**
 * 라이브 — one host, a code, and however many people turn up.
 *
 * There is no seat limit anywhere in this file or in the schema behind it. The
 * race rooms allocate a seat out of eight because eight cars have to fit on a
 * road; a live session has nothing to allocate, so it allocates nothing.
 *
 * The traffic is deliberately lopsided, which is what makes "no limit" real:
 *  - fan-OUT (host advances the question) rides realtime on ONE session row,
 *    so a thousand players cost one row update;
 *  - fan-IN (everyone answering at once) is never broadcast. The host asks for
 *    a count on a timer instead, so N answers cost one query, not N messages.
 */

export type LivePhase = "lobby" | "asking" | "revealed" | "ended";

export type LiveSession = {
  code: string;
  host_id: string;
  title: string;
  phase: LivePhase;
  current_idx: number;
  question_count: number;
  reveal_choice: "a" | "b" | null;
};

/** A question as the host writes it. `answer` is null for a balance card. */
export type LiveQuestion = {
  kind: "quiz" | "balance";
  prompt: string;
  a_emoji: string;
  a_text: string;
  b_emoji: string;
  b_text: string;
  answer: "a" | "b" | null;
  note: string | null;
};

/** A question as a player receives it - the answer only arrives on reveal. */
export type LiveCurrent = LiveQuestion & {
  idx: number;
  phase: LivePhase;
  question_count: number;
  title: string;
};

export type LiveBoard = { answered: number; count_a: number; count_b: number; players: number };
export type LiveTally = { count_a: number; count_b: number; answered: number };
export type LiveScore = {
  player_id: string; nickname: string; score: number; hits: number;
  rank: number; is_me: boolean;
};

/**
 * The host's proof that they are the host.
 *
 * Kept per code so one browser can host several sessions over time, and never
 * sent anywhere except as an argument to the host-only functions. It is not in
 * live_sessions, because that row is world-readable - it lives in a table with
 * no policies at all, reachable only from inside those functions.
 */
const TOKEN_KEY = (code: string) => `ddr.live.${code}`;

/**
 * A player's seat secret, and the id the seat came back with.
 *
 * The id used to be the player's own local identity, sent as an argument and
 * trusted - but live_players is the leaderboard, so those ids were listed, not
 * guessed, and anyone with the room code could answer as a classmate. Now the
 * client proves who it is with a secret it generates and never shows, and the
 * id is whatever the server hands back: safe to print, useless to copy.
 *
 * Per code, so one device can hold seats in several sessions, and stored so a
 * reload comes back to the same seat instead of joining twice.
 */
const SEAT_KEY = (code: string) => `ddr.live.seat.${code}`;

type Seat = { token: string; id: string };

function newToken() {
  const b = new Uint8Array(24);
  crypto.getRandomValues(b);
  return [...b].map((n) => n.toString(36).padStart(2, "0")).join("");
}

function readSeat(code: string): Seat | null {
  try {
    const raw = localStorage.getItem(SEAT_KEY(code));
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<Seat>;
    return p.token && p.id ? { token: p.token, id: p.id } : null;
  } catch {
    return null;
  }
}

function keepSeat(code: string, seat: Seat) {
  try {
    localStorage.setItem(SEAT_KEY(code), JSON.stringify(seat));
  } catch {
    // a private window means a reload joins again as a new seat; the old one
    // is simply abandoned, which is a stale name on the board and nothing more
  }
}

/** My seat id in this session, once I have joined. */
export function seatId(code: string): string | null {
  return readSeat(code)?.id ?? null;
}

export function hostToken(code: string): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY(code));
  } catch {
    return null;
  }
}

function keepToken(code: string, token: string) {
  try {
    localStorage.setItem(TOKEN_KEY(code), token);
  } catch {
    // a private window means a reload loses the host seat; the session lives on
  }
}

export async function createLive(title: string): Promise<{ code: string; token: string }> {
  const me = getIdentity();
  const db = supabase();

  // A collision would hand two hosts the same code, so retry rather than
  // surfacing a duplicate-key error.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = makeRoomCode();
    const token = newToken();
    const { error } = await db.rpc("live_create", {
      p_code: code, p_host: me.id, p_token: token, p_title: title,
    });
    if (!error) {
      keepToken(code, token);
      rememberActive(code);
      return { code, token };
    }
    if (!String(error.message).includes("duplicate key")) throw error;
  }
  throw new Error("코드를 만들지 못했다. 다시 해볼래?");
}

/**
 * Which session this browser is hosting right now.
 *
 * A host who locks their phone mid-session and comes back should find the
 * session, not a blank screen and a room full of people waiting - so the code
 * is remembered alongside its token.
 */
const ACTIVE = "ddr.live.active";

export function rememberActive(code: string | null) {
  try {
    if (code) localStorage.setItem(ACTIVE, code);
    else localStorage.removeItem(ACTIVE);
  } catch { /* private window: no resume, but the session still runs */ }
}

export function activeCode(): string | null {
  try {
    const code = localStorage.getItem(ACTIVE);
    return code && hostToken(code) ? code : null;
  } catch {
    return null;
  }
}

/** The host reading their own questions back - answers and all. */
export async function hostQuestions(code: string): Promise<LiveQuestion[]> {
  const token = hostToken(code);
  if (!token) return [];
  const { data, error } = await supabase().rpc("live_host_questions", {
    p_code: code, p_token: token,
  });
  if (error) throw error;
  return (data ?? []) as LiveQuestion[];
}

export async function setQuestions(code: string, questions: LiveQuestion[]) {
  const token = hostToken(code);
  if (!token) throw new Error("이 기기는 이 방의 방장이 아니다.");
  const { error } = await supabase().rpc("live_set_questions", {
    p_code: code,
    p_token: token,
    p_questions: questions.map((q) => ({
      kind: q.kind,
      prompt: q.prompt,
      a_emoji: q.a_emoji, a_text: q.a_text,
      b_emoji: q.b_emoji, b_text: q.b_text,
      answer: q.answer ?? "",
      note: q.note ?? "",
    })),
  });
  if (error) throw error;
}

export async function advance(code: string, to: "asking" | "revealed" | "ended", idx: number) {
  const token = hostToken(code);
  if (!token) throw new Error("이 기기는 이 방의 방장이 아니다.");
  const { error } = await supabase().rpc("live_advance", {
    p_code: code, p_token: token, p_to: to, p_idx: idx,
  });
  if (error) throw error;
}

export async function board(code: string): Promise<LiveBoard | null> {
  const token = hostToken(code);
  if (!token) return null;
  const { data, error } = await supabase().rpc("live_board", { p_code: code, p_token: token });
  if (error) throw error;
  return (data?.[0] ?? null) as LiveBoard | null;
}

export async function joinLive(code: string, nickname: string) {
  // reuse this device's secret for this session, so a reload keeps the seat
  const token = readSeat(code)?.token ?? newToken();
  const { data, error } = await supabase().rpc("live_join", {
    p_code: code, p_token: token, p_nick: nickname,
  });
  if (error) throw error;
  const row = data?.[0] as {
    seat_id: string; phase: LivePhase; current_idx: number;
    question_count: number; title: string;
  };
  keepSeat(code, { token, id: row.seat_id });
  return row;
}

export async function currentQuestion(code: string): Promise<LiveCurrent | null> {
  const { data, error } = await supabase().rpc("live_current", { p_code: code });
  if (error) throw error;
  return (data?.[0] ?? null) as LiveCurrent | null;
}

export async function answerLive(code: string, idx: number, choice: "a" | "b") {
  const seat = readSeat(code);
  if (!seat) throw new Error("not in this session");
  const { error } = await supabase().rpc("live_answer", {
    p_code: code, p_token: seat.token, p_idx: idx, p_choice: choice,
  });
  if (error) throw error;
}

export async function tally(code: string): Promise<LiveTally | null> {
  const { data, error } = await supabase().rpc("live_tally", { p_code: code });
  if (error) return null;                 // "not revealed yet" is not a failure
  return (data?.[0] ?? null) as LiveTally | null;
}

export async function scores(code: string, top = 10): Promise<LiveScore[]> {
  const { data, error } = await supabase().rpc("live_scores", {
    p_code: code, p_player: seatId(code) ?? "", p_top: top,
  });
  if (error) throw error;
  return (data ?? []) as LiveScore[];
}

export async function readSession(code: string): Promise<LiveSession | null> {
  const { data, error } = await supabase()
    .from("live_sessions")
    .select("code, host_id, title, phase, current_idx, question_count, reveal_choice")
    .eq("code", code)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as LiveSession | null;
}

/** Just the count, without pulling a row per player down the wire. */
export async function playerCount(code: string): Promise<number> {
  const { count, error } = await supabase()
    .from("live_players")
    .select("player_id", { count: "exact", head: true })
    .eq("code", code);
  if (error) throw error;
  return count ?? 0;
}

/**
 * Watch a session. Realtime on the one row, with a slow poll behind it:
 * a websocket that quietly drops is the difference between "the host moved on"
 * and a room full of people staring at a stale question.
 */
export function watchSession(code: string, onChange: (s: LiveSession) => void) {
  const db = supabase();
  const pull = async () => {
    try {
      const s = await readSession(code);
      if (s) onChange(s);
    } catch {
      // a dropped poll is not worth surfacing; the next one is 2.5s away
    }
  };

  const ch = db
    .channel(`live:${code}`)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "live_sessions", filter: `code=eq.${code}` },
      (msg) => onChange(msg.new as LiveSession)
    )
    .subscribe();

  void pull();
  const timer = window.setInterval(pull, 2500);

  return () => {
    window.clearInterval(timer);
    void db.removeChannel(ch);
  };
}
