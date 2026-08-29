/**
 * PARKED — not reachable from the menu, and deliberately kept.
 *
 * The race room is Phase 4 and Phase 4 is not finished: there is no online
 * round synchronisation, so this lobby gathers people and then has nowhere to
 * send them. Two menu rows that lead to a dead end are worse than two rows
 * that are not there, so 방 만들기 is out of the menu and 참가하기 now goes
 * straight to a live session.
 *
 * Deleted, this would have to be written again; unreferenced, it costs the
 * bundle nothing (Vite drops it) and it is here the day round sync lands.
 * What is still missing: dealing the deck server-side, closing a round on a
 * shared clock, broadcasting the moves, filling empty seats with bots, and
 * handling someone closing their tab mid-round.
 *
 * It also still has the identity hole that live sessions fixed in 0007 - the
 * player id is taken as an argument and trusted, and `players` is world
 * readable. Nothing can be submitted today because there is no game to submit
 * to, but that has to be closed with the same seat-token trick before this is
 * ever wired up.
 */
import type { Player } from "../game/types";
import { PLAYER_COLORS } from "../game/setup";
import { getIdentity } from "./identity";
import { makeRoomCode, supabase } from "./supabase";

export const MAX_SEATS = 8;

export type RoomRow = {
  code: string;
  host_id: string;
  status: "lobby" | "playing" | "done";
  round: number;
  round_ends_at: string | null;
};

export type PlayerRow = {
  room_code: string;
  player_id: string;
  nickname: string;
  seat: number;
  color: string;
  is_bot: boolean;
  pos: number;
  charge: number;
};

/** A row becomes a game Player; the seat is the id the rules already use. */
export function toPlayer(row: PlayerRow): Player {
  return {
    id: row.seat,
    name: row.nickname,
    color: row.color,
    isBot: row.is_bot,
    pos: row.pos,
    charge: row.charge,
  };
}

export async function createRoom(): Promise<RoomRow> {
  const me = getIdentity();
  const db = supabase();

  // A collision is a wrong-room bug, not a duplicate-key error, so retry.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = makeRoomCode();
    const { data, error } = await db
      .from("rooms")
      .insert({ code, host_id: me.id, status: "lobby" })
      .select()
      .single();

    if (!error && data) {
      await joinRoom(code, 0);
      return data as RoomRow;
    }
    if (error && error.code !== "23505") throw error;
  }
  throw new Error("방 코드를 만들지 못했습니다. 다시 시도해 주세요.");
}

export async function joinRoom(code: string, seatHint?: number): Promise<RoomRow> {
  const me = getIdentity();
  const db = supabase();

  const { data: room, error: roomErr } = await db
    .from("rooms")
    .select()
    .eq("code", code)
    .maybeSingle();
  if (roomErr) throw roomErr;
  if (!room) throw new Error("그런 방이 없습니다. 코드를 확인해 주세요.");
  if (room.status !== "lobby") throw new Error("이미 시작한 방입니다.");

  const { data: seated, error: seatErr } = await db
    .from("players")
    .select("seat, player_id")
    .eq("room_code", code);
  if (seatErr) throw seatErr;

  const mine = seated?.find((p) => p.player_id === me.id);
  const taken = new Set((seated ?? []).map((p) => p.seat));
  const seat = mine?.seat ?? seatHint ?? nextFreeSeat(taken);
  if (seat === null) throw new Error("방이 가득 찼습니다.");

  const { error } = await db.from("players").upsert(
    {
      room_code: code,
      player_id: me.id,
      nickname: me.nickname,
      seat,
      color: PLAYER_COLORS[seat % PLAYER_COLORS.length],
      is_bot: false,
      last_seen: new Date().toISOString(),
    },
    { onConflict: "room_code,player_id" }
  );
  if (error) throw error;

  return room as RoomRow;
}

function nextFreeSeat(taken: Set<number>): number | null {
  for (let s = 0; s < MAX_SEATS; s++) if (!taken.has(s)) return s;
  return null;
}

export async function leaveRoom(code: string) {
  const me = getIdentity();
  await supabase().from("players").delete().eq("room_code", code).eq("player_id", me.id);
}

export async function listPlayers(code: string): Promise<PlayerRow[]> {
  const { data, error } = await supabase()
    .from("players")
    .select()
    .eq("room_code", code)
    .order("seat");
  if (error) throw error;
  return (data ?? []) as PlayerRow[];
}

/** Submitting is write-once: the primary key rejects a second attempt. */
export async function submitChoice(
  code: string,
  round: number,
  choice: "a" | "b",
  useBoost: boolean,
  stake: number
) {
  const me = getIdentity();
  const { error } = await supabase().from("choices").insert({
    room_code: code, round, player_id: me.id, choice, use_boost: useBoost, stake,
  });
  if (error && error.code !== "23505") throw error;
}

export async function lockedCount(code: string, round: number): Promise<number> {
  const { data, error } = await supabase().rpc("locked_count", {
    p_room: code, p_round: round,
  });
  if (error) throw error;
  return (data as number) ?? 0;
}

/** Throws while the round is still open - that refusal is the anti-peek rule. */
export async function closeRound(code: string, round: number) {
  const { data, error } = await supabase().rpc("close_round", {
    p_room: code, p_round: round,
  });
  if (error) throw error;
  return (data ?? []) as {
    player_id: string; choice: "a" | "b"; use_boost: boolean; stake: number;
  }[];
}
