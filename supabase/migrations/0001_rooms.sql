-- 밸런스 레이스 — online rooms
--
-- The one rule this schema exists to enforce: nobody can see what anyone else
-- picked until the round is closed. Everything else is bookkeeping.

create table if not exists public.rooms (
  code           text primary key,
  host_id        text        not null,
  status         text        not null default 'lobby'
                 check (status in ('lobby', 'playing', 'done')),
  round          int         not null default 0,
  deck           jsonb       not null default '[]'::jsonb,
  round_ends_at  timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists public.players (
  room_code  text        not null references public.rooms(code) on delete cascade,
  player_id  text        not null,
  nickname   text        not null,
  seat       int         not null,
  color      text        not null,
  is_bot     boolean     not null default false,
  pos        int         not null default 0,
  charge     int         not null default 0,
  last_seen  timestamptz not null default now(),
  primary key (room_code, player_id)
);

create index if not exists players_room_idx on public.players (room_code);

create table if not exists public.choices (
  room_code  text        not null,
  round      int         not null,
  player_id  text        not null,
  choice     text        not null check (choice in ('a', 'b')),
  use_boost  boolean     not null default false,
  stake      real        not null default 0.2,
  created_at timestamptz not null default now(),
  -- write-once: the primary key is what stops anyone changing their mind after
  -- watching the lock pips fill up
  primary key (room_code, round, player_id)
);

-- ---------------------------------------------------------------- row security

alter table public.rooms   enable row level security;
alter table public.players enable row level security;
alter table public.choices enable row level security;

-- A room code is the only secret there is, so anyone holding one may read the
-- room and its players. That is the same information everyone at the table can
-- see anyway.
create policy rooms_read   on public.rooms   for select using (true);
create policy rooms_create on public.rooms   for insert with check (true);
create policy rooms_update on public.rooms   for update using (true);

create policy players_read   on public.players for select using (true);
create policy players_join   on public.players for insert with check (true);
create policy players_update on public.players for update using (true);

-- Choices are the exception, and the whole point.
--
-- INSERT is allowed; SELECT is allowed to NOBODY. There is deliberately no
-- select policy, so with RLS on, every direct read returns zero rows - the
-- anon key cannot peek at the table even by asking for it. The tally comes
-- back only from close_round(), and only once the round is actually over.
create policy choices_submit on public.choices for insert with check (true);

-- ------------------------------------------------------------------- tallying

-- SECURITY DEFINER so it can read choices past the RLS wall above. It refuses
-- to answer early: the round has to be closed either by the clock running out
-- or by everyone having answered.
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

  if now() < v_ends and v_locked < v_people then
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

-- How many have committed, without saying what they committed to. This is what
-- fills the lock pips.
create or replace function public.locked_count(p_room text, p_round int)
returns int
language sql
security definer
set search_path = public
as $$
  select count(*)::int from choices where room_code = p_room and round = p_round;
$$;

revoke all on function public.locked_count(text, int) from public;
grant execute on function public.locked_count(text, int) to anon, authenticated;

-- ------------------------------------------------------------------- realtime

-- choices is deliberately NOT published: a realtime subscription would stream
-- exactly the thing the whole design is trying to hide.
-- Guarded, because `add table` errors if the table is already published and
-- that would abort a re-run of this file halfway through.
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime'
                   and schemaname = 'public' and tablename = 'rooms') then
    alter publication supabase_realtime add table public.rooms;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime'
                   and schemaname = 'public' and tablename = 'players') then
    alter publication supabase_realtime add table public.players;
  end if;
end $$;
