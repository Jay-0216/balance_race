-- Two holes in close_round's early-close path, both of which let a round be
-- read while its clock was still running. Found by a smoke test, not by
-- reading: the first one fired on the very first run.
--
-- (1) close_round asked "have as many people answered as there are people?"
--     With zero player rows that is 1 >= 0 - true - so a room with no players
--     answered immediately.
--
-- (2) players_update is `using (true)`, so anyone holding a room code could
--     flip other players to is_bot = true. Bots are excluded from the
--     headcount, so setting six of eight to bots dropped the requirement to
--     two and the round could be closed - and every pick read - early.
--     Ownership cannot be enforced while guests play without accounts, but
--     the columns that decide the headcount have no business changing at all.

create or replace function public.close_round(p_room text, p_round int)
returns table (player_id text, choice text, use_boost boolean, stake real)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ends   timestamptz;
  v_people int;
  v_locked int;
begin
  select round_ends_at into v_ends from rooms where code = p_room;
  if v_ends is null then
    raise exception 'unknown room';
  end if;

  select count(*) into v_people from players where room_code = p_room and not is_bot;
  select count(*) into v_locked from choices where room_code = p_room and round = p_round;

  -- The clock is the authority. Closing early is only a convenience, and it
  -- needs a real table to be true of: an empty or single-seat room can never
  -- satisfy "everyone has answered".
  if now() < v_ends and (v_people < 2 or v_locked < v_people) then
    raise exception 'round still open';
  end if;

  return query
    select c.player_id, c.choice, c.use_boost, c.stake
    from choices c
    where c.room_code = p_room and c.round = p_round;
end;
$$;

revoke all on function public.close_round(text, int) from public;
grant execute on function public.close_round(text, int) to anon, authenticated;

-- Seat, identity and bot-ness are set when you join and never change. Score
-- and charge are the game's to move. A trigger rather than a policy, because
-- an RLS UPDATE check cannot see the old row and the new one at the same time.
create or replace function public.players_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.player_id is distinct from old.player_id
     or new.room_code is distinct from old.room_code
     or new.is_bot   is distinct from old.is_bot
     or new.seat     is distinct from old.seat then
    raise exception 'seat, identity and bot flag are fixed once you join';
  end if;
  return new;
end;
$$;

drop trigger if exists players_guard_update on public.players;
create trigger players_guard_update
  before update on public.players
  for each row execute function public.players_guard();

-- choices had no foreign key to rooms, so deleting a room left its choices
-- behind forever: rows nobody can read, nobody can reach, one per player per
-- round. Noticed when a test room was deleted and its choice row stayed.
delete from public.choices c
  where not exists (select 1 from public.rooms r where r.code = c.room_code);

alter table public.choices drop constraint if exists choices_room_code_fkey;
alter table public.choices
  add constraint choices_room_code_fkey
  foreign key (room_code) references public.rooms(code) on delete cascade;
