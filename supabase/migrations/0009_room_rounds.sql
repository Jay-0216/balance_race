-- Phase 4's missing half: an online race that actually runs.
--
-- The shape of the answer matters more than the SQL. **The rules are not in
-- here.** resolveRound() in src/game/rules.ts is tuned, simulated over a
-- thousand games, and already the single definition of how a round pays out;
-- writing a second copy in PL/pgSQL would mean two rulebooks that drift, and
-- the drift would show up as two players seeing different positions.
--
-- So the database stores *choices* and hands them back once a round is closed,
-- and every client replays the same pure function over the same inputs. A
-- room's state is f(frozen deck, frozen roster, every closed round's choices).
-- Nobody writes positions, so nobody can disagree about them.
--
-- Three things fall out of that for free:
--   - **no host dependency.** Anyone may close and advance a round, so the
--     game does not stall when whoever made the room closes their tab.
--   - **bots need no rows and no writes.** Their choices come from a seeded
--     RNG keyed by the room and round, so every client derives the same ones.
--   - **a disconnect is just a missing choice**, filled from the same seed.
--
-- Identity uses the seat-token trick from 0007, because the old design here
-- had exactly the hole live sessions had: player_id was taken as an argument
-- and trusted, and `players` is world-readable.

-- one abandoned lobby from before any of this worked
delete from public.rooms where status = 'lobby';

alter table public.rooms add column if not exists roster jsonb;

-- The host's bearer secret, in its own table for the same reason as live:
-- `rooms` has to be world-readable, and RLS is row-level, not column-level.
create table if not exists public.room_secrets (
  code       text primary key references public.rooms(code) on delete cascade,
  host_token text not null
);

create table if not exists public.room_seats (
  code      text not null references public.rooms(code) on delete cascade,
  token     text not null check (length(token) >= 16),
  seat      int  not null check (seat between 0 and 7),
  user_id   uuid references auth.users(id) on delete set null,
  joined_at timestamptz not null default now(),
  primary key (code, token),
  unique (code, seat)
);

alter table public.room_secrets enable row level security;
alter table public.room_seats   enable row level security;
-- no policies on either: reachable only from the functions below

-- Choices are keyed by SEAT now, not by a client-supplied id. The seat is what
-- the rules already call a player, and it is the only thing a token can prove.
drop table if exists public.choices;
create table public.choices (
  room_code  text        not null references public.rooms(code) on delete cascade,
  round      int         not null,
  seat       int         not null,
  choice     text        not null check (choice in ('a', 'b')),
  use_boost  boolean     not null default false,
  stake      real        not null default 0.2,
  created_at timestamptz not null default now(),
  -- write-once: this is what stops anyone changing their mind after watching
  -- the lock pips fill up
  primary key (room_code, round, seat)
);

alter table public.choices enable row level security;
-- and still no select policy, deliberately: the tally comes back only from
-- room_close(), and only once the round is actually over

drop policy if exists rooms_update on public.rooms;
drop policy if exists players_update on public.players;
drop policy if exists players_join on public.players;
-- rooms and players are now written only through the functions, so the blanket
-- write policies that let anyone edit anyone go away

drop function if exists public.close_round(text, int);
drop function if exists public.locked_count(text, int);

create or replace function public.room_is_host(p_code text, p_token text)
returns boolean language sql security definer set search_path = public as $$
  select exists (select 1 from room_secrets where code = p_code and host_token = p_token);
$$;

create or replace function public.room_create(p_code text, p_host text, p_token text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if length(coalesce(p_token, '')) < 16 then raise exception 'weak host token'; end if;
  insert into rooms (code, host_id, status) values (p_code, p_host, 'lobby');
  insert into room_secrets (code, host_token) values (p_code, p_token);
end;
$$;

/** Claim a seat, or come back to the one this device already holds. */
create or replace function public.room_join(p_code text, p_token text, p_nick text)
returns table (seat int, status text, round int)
language plpgsql security definer set search_path = public as $$
declare
  v_seat record;
  v_uid  uuid := auth.uid();
  v_free int;
  v_room record;
begin
  if length(coalesce(p_token, '')) < 16 then raise exception 'weak seat token'; end if;
  select * into v_room from rooms r where r.code = p_code;
  if not found then raise exception 'no such room'; end if;

  select * into v_seat from room_seats s where s.code = p_code and s.token = p_token;

  if not found then
    if v_room.status <> 'lobby' then raise exception 'already started'; end if;
    -- lowest free seat, so the colours fill in a predictable order
    select min(g) into v_free from generate_series(0, 7) g
     where not exists (select 1 from room_seats s where s.code = p_code and s.seat = g);
    if v_free is null then raise exception 'room is full'; end if;
    insert into room_seats (code, token, seat, user_id)
    values (p_code, p_token, v_free, v_uid)
    returning * into v_seat;
  elsif v_seat.user_id is not null and v_seat.user_id is distinct from v_uid then
    raise exception 'seat belongs to another account';
  end if;

  insert into players (room_code, player_id, nickname, seat, color, is_bot, last_seen)
  values (p_code, p_code || ':' || v_seat.seat, left(btrim(p_nick), 8), v_seat.seat, '', false, now())
  on conflict (room_code, player_id)
  do update set nickname = excluded.nickname, last_seen = now();

  return query select v_seat.seat, v_room.status, v_room.round;
end;
$$;

/**
 * Freeze the deck and the roster, and start the clock.
 *
 * Both are frozen here rather than derived later because a player joining
 * after the start would otherwise change what everyone else replays.
 */
create or replace function public.room_start(
  p_code text, p_token text, p_deck jsonb, p_roster jsonb, p_seconds int
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not room_is_host(p_code, p_token) then raise exception 'not the host'; end if;
  if not exists (select 1 from rooms where code = p_code and status = 'lobby') then
    raise exception 'already started';
  end if;
  if jsonb_array_length(p_deck) < 1 or jsonb_array_length(p_deck) > 40 then
    raise exception 'bad deck';
  end if;
  if jsonb_array_length(p_roster) < 2 or jsonb_array_length(p_roster) > 8 then
    raise exception 'bad roster';
  end if;

  update rooms
     set status = 'playing', round = 1, deck = p_deck, roster = p_roster,
         round_ends_at = now() + make_interval(secs => greatest(5, least(120, p_seconds))),
         updated_at = now()
   where code = p_code;
end;
$$;

/** Write-once, for the round actually open, from the seat holding the token. */
create or replace function public.room_submit(
  p_code text, p_token text, p_round int,
  p_choice text, p_boost boolean, p_stake real
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_room record;
  v_seat record;
  v_uid  uuid := auth.uid();
begin
  select * into v_room from rooms r where r.code = p_code;
  if not found then raise exception 'no such room'; end if;
  if v_room.status <> 'playing' then raise exception 'not playing'; end if;
  if v_room.round <> p_round then raise exception 'wrong round'; end if;
  if now() > v_room.round_ends_at + interval '2 seconds' then raise exception 'round is over'; end if;

  select * into v_seat from room_seats s where s.code = p_code and s.token = p_token;
  if not found then raise exception 'not in this room'; end if;
  if v_seat.user_id is not null and v_seat.user_id is distinct from v_uid then
    raise exception 'not your seat';
  end if;

  insert into choices (room_code, round, seat, choice, use_boost, stake)
  values (p_code, p_round, v_seat.seat, p_choice, coalesce(p_boost, false), coalesce(p_stake, 0.2))
  on conflict do nothing;
end;
$$;

/** How many have committed, without saying what to. Fills the lock pips. */
create or replace function public.room_locked(p_code text, p_round int)
returns int language sql security definer set search_path = public as $$
  select count(*)::int from choices where room_code = p_code and round = p_round;
$$;

/**
 * The choices for a round, once it is genuinely over.
 *
 * Refuses while the clock is running and anyone still has a choice to make -
 * that refusal is the whole anti-peek rule.
 */
create or replace function public.room_close(p_code text, p_round int)
returns table (seat int, choice text, use_boost boolean, stake real)
language plpgsql security definer set search_path = public as $$
declare
  v_room   record;
  v_humans int;
  v_locked int;
begin
  select * into v_room from rooms r where r.code = p_code;
  if not found then raise exception 'no such room'; end if;
  if v_room.round_ends_at is null then raise exception 'not started'; end if;
  if p_round > v_room.round then raise exception 'round has not been asked yet'; end if;

  select count(*) into v_humans
    from jsonb_array_elements(coalesce(v_room.roster, '[]'::jsonb)) e
   where (e ->> 'bot')::boolean is not true;
  select count(*) into v_locked from choices where room_code = p_code and round = p_round;

  -- Only the round still being played can be early. Past rounds are closed by
  -- definition, which is what lets a latecomer replay the whole game.
  if p_round = v_room.round and now() < v_room.round_ends_at
     and (v_humans < 1 or v_locked < v_humans) then
    raise exception 'round still open';
  end if;

  return query
    select c.seat, c.choice, c.use_boost, c.stake
    from choices c where c.room_code = p_code and c.round = p_round;
end;
$$;

/**
 * Move the room on. Anyone may call it, and calling it twice does nothing -
 * which is what removes the host from the critical path entirely.
 */
create or replace function public.room_next(p_code text, p_round int, p_seconds int)
returns int language plpgsql security definer set search_path = public as $$
declare v_room record;
begin
  select * into v_room from rooms r where r.code = p_code;
  if not found then raise exception 'no such room'; end if;
  if v_room.status <> 'playing' then return v_room.round; end if;
  if v_room.round <> p_round then return v_room.round; end if;   -- someone beat us to it

  -- the same gate as room_close: no skipping a round that is still live
  perform room_close(p_code, p_round);

  if p_round >= jsonb_array_length(coalesce(v_room.deck, '[]'::jsonb)) then
    update rooms set status = 'done', updated_at = now() where code = p_code;
    return v_room.round;
  end if;

  update rooms
     set round = p_round + 1,
         round_ends_at = now() + make_interval(secs => greatest(5, least(120, p_seconds))),
         updated_at = now()
   where code = p_code;
  return p_round + 1;
end;
$$;

/** The room is over when someone says so - or when the deck runs out. */
create or replace function public.room_finish(p_code text) returns void
language sql security definer set search_path = public as $$
  update rooms set status = 'done', updated_at = now() where code = p_code;
$$;
