import { BOT_ROSTER } from "../game/bots";
import type { ClosedRound, Seat } from "../game/replay";
import { ROUNDS, TIME_LIMIT } from "../game/rules";
import { dealDeck, PLAYER_COLORS } from "../game/setup";
import type { Choice, Dilemma, Player } from "../game/types";
import { getIdentity } from "./identity";
import { makeRoomCode, supabase } from "./supabase";

/**
 * The online race room.
 *
 * The database stores a frozen deck, a frozen roster and the choices for each
 * round; positions are never written anywhere. Every client replays them with
 * the same pure rules (see game/replay.ts), which is what lets a room carry on
 * when the person who made it closes their tab.
 *
 * Identity is a seat token, the same trick live sessions use: the client
 * proves which seat it holds with a secret it generates and never shows, and
 * the seat number - the only thing anyone else sees - proves nothing.
 */

export const MAX_SEATS = 8;

export type RoomRow = {
  code: string;
  host_id: string;
  status: "lobby" | "playing" | "done";
  round: number;
  round_ends_at: string | null;
  deck: Dilemma[] | null;
  roster: Seat[] | null;
};

export type PlayerRow = {
  room_code: string;
  player_id: string;
  nickname: string;
  seat: number;
  is_bot: boolean;
};

const HOST_KEY = (code: string) => `ddr.room.host.${code}`;
const SEAT_KEY = (code: string) => `ddr.room.seat.${code}`;

type SeatHold = { token: string; seat: number };

function newToken() {
  const b = new Uint8Array(24);
  crypto.getRandomValues(b);
  return [...b].map((n) => n.toString(36).padStart(2, "0")).join("");
}

const readKey = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const writeKey = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* private window: the seat is lost on reload and rejoined as a new one */
  }
};

export function hostToken(code: string) {
  return readKey(HOST_KEY(code));
}

export function mySeat(code: string): SeatHold | null {
  const raw = readKey(SEAT_KEY(code));
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Partial<SeatHold>;
    return typeof p.token === "string" && typeof p.seat === "number"
      ? { token: p.token, seat: p.seat }
      : null;
  } catch {
    return null;
  }
}

export async function createRoom(nickname: string): Promise<RoomRow> {
  const me = getIdentity();
  const db = supabase();

  // A collision would hand two hosts one room, so retry rather than surfacing
  // a duplicate-key error.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = makeRoomCode();
    const token = newToken();
    const { error } = await db.rpc("room_create", {
      p_code: code, p_host: me.id, p_token: token,
    });
    if (!error) {
      writeKey(HOST_KEY(code), token);
      await joinRoom(code, nickname);
      return (await readRoom(code))!;
    }
    if (!String(error.message).includes("duplicate key")) throw error;
  }
  throw new Error("방 코드를 만들지 못했다. 다시 해볼래?");
}

export async function joinRoom(code: string, nickname: string): Promise<number> {
  const held = mySeat(code);
  const token = held?.token ?? newToken();
  const { data, error } = await supabase().rpc("room_join", {
    p_code: code, p_token: token, p_nick: nickname,
  });
  if (error) throw error;
  const row = data?.[0] as { seat: number; status: string; round: number };
  writeKey(SEAT_KEY(code), JSON.stringify({ token, seat: row.seat }));
  return row.seat;
}

export async function readRoom(code: string): Promise<RoomRow | null> {
  const { data, error } = await supabase()
    .from("rooms")
    .select("code, host_id, status, round, round_ends_at, deck, roster")
    .eq("code", code)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as RoomRow | null;
}

export async function listPlayers(code: string): Promise<PlayerRow[]> {
  const { data, error } = await supabase()
    .from("players")
    .select("room_code, player_id, nickname, seat, is_bot")
    .eq("room_code", code)
    .order("seat");
  if (error) throw error;
  return (data ?? []) as PlayerRow[];
}

/**
 * Freeze the deck and the roster and start the clock.
 *
 * Empty seats become bots here, once, rather than being decided per client:
 * the roster is the agreement about who is in this race, and it has to be the
 * same agreement for a player who joins the view three rounds later.
 */
export async function startRoom(code: string, humans: PlayerRow[]) {
  const token = hostToken(code);
  if (!token) throw new Error("이 기기는 이 방의 방장이 아니다.");

  const taken = new Set(humans.map((p) => p.seat));
  const roster: Seat[] = [];
  let bot = 0;
  for (let seat = 0; seat < MAX_SEATS; seat++) {
    const human = humans.find((p) => p.seat === seat);
    if (human) {
      roster.push({ seat, name: human.nickname, color: PLAYER_COLORS[seat], bot: false });
    } else if (taken.size + bot < MAX_SEATS) {
      const b = BOT_ROSTER[bot % BOT_ROSTER.length];
      roster.push({ seat, name: b.name, color: PLAYER_COLORS[seat], bot: true, profile: bot % BOT_ROSTER.length });
      bot++;
    }
  }

  const { error } = await supabase().rpc("room_start", {
    p_code: code, p_token: token,
    p_deck: dealDeck(ROUNDS), p_roster: roster, p_seconds: TIME_LIMIT,
  });
  if (error) throw error;
}

export async function submitChoice(
  code: string, round: number, choice: Choice, useBoost: boolean, stake: number
) {
  const held = mySeat(code);
  if (!held) throw new Error("이 방에 자리가 없다.");
  const { error } = await supabase().rpc("room_submit", {
    p_code: code, p_token: held.token, p_round: round,
    p_choice: choice, p_boost: useBoost, p_stake: stake,
  });
  if (error && !String(error.message).includes("duplicate")) throw error;
}

export async function lockedCount(code: string, round: number): Promise<number> {
  const { data, error } = await supabase().rpc("room_locked", { p_code: code, p_round: round });
  if (error) throw error;
  return (data as number) ?? 0;
}

/** Throws while the round is still open - that refusal is the anti-peek rule. */
export async function closeRound(code: string, round: number): Promise<ClosedRound> {
  const { data, error } = await supabase().rpc("room_close", { p_code: code, p_round: round });
  if (error) throw error;
  const out: ClosedRound = {};
  for (const r of (data ?? []) as { seat: number; choice: Choice; use_boost: boolean; stake: number }[]) {
    out[r.seat] = { choice: r.choice, useBoost: r.use_boost, stake: r.stake };
  }
  return out;
}

/** Idempotent: whoever gets there first moves the room on, the rest no-op. */
export async function nextRound(code: string, round: number): Promise<number> {
  const { data, error } = await supabase().rpc("room_next", {
    p_code: code, p_round: round, p_seconds: TIME_LIMIT,
  });
  if (error) throw error;
  return (data as number) ?? round;
}

export async function finishRoom(code: string) {
  await supabase().rpc("room_finish", { p_code: code });
}

export async function leaveRoom(code: string) {
  const held = mySeat(code);
  if (!held) return;
  await supabase()
    .from("players")
    .delete()
    .eq("room_code", code)
    .eq("player_id", `${code}:${held.seat}`);
}

/** Seats become the players the rules already understand. */
export function playersFromRoster(roster: Seat[]): Player[] {
  return roster.map((s) => ({
    id: s.seat,
    name: s.name,
    color: s.color || PLAYER_COLORS[s.seat % PLAYER_COLORS.length],
    isBot: s.bot,
    profile: s.bot ? BOT_ROSTER[(s.profile ?? 0) % BOT_ROSTER.length].profile : undefined,
    pos: 0,
    charge: 0,
  }));
}

/** The room row is the one thing pushed to every device. */
export function watchRoom(code: string, onChange: (r: RoomRow) => void) {
  const db = supabase();
  const pull = async () => {
    try {
      const r = await readRoom(code);
      if (r) onChange(r);
    } catch {
      /* a dropped poll is not worth surfacing; the next one is 2s away */
    }
  };
  const ch = db
    .channel(`room:${code}`)
    .on("postgres_changes",
      { event: "UPDATE", schema: "public", table: "rooms", filter: `code=eq.${code}` },
      (msg) => onChange(msg.new as RoomRow))
    .subscribe();
  void pull();
  const timer = window.setInterval(pull, 2000);
  return () => {
    window.clearInterval(timer);
    void db.removeChannel(ch);
  };
}
