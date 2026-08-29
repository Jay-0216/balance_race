-- Closing the impersonation hole in live sessions.
--
-- The old design took the player's id as an argument and trusted it. That id
-- was a random value kept in the player's own browser, which the plan treated
-- as "hard to guess" - but live_players is world-readable (it is the
-- leaderboard), so the ids were not guessed at all, they were *listed*.
-- Anyone holding the room code could read a classmate's id straight off the
-- table and submit an answer as them; because answers are write-once, the
-- victim then could not answer at all.
--
-- Reproduced as the anon role before writing this:
--   select player_id from live_players where code = 'PROBE1'
--     -> 'victim-local-abc123'
--   select live_answer('PROBE1', 'victim-local-abc123', 0, 'b')
--     -> answered 1 · B 1        (the victim's answer, cast by a stranger)
--
-- The fix is to stop taking identity as an argument at all. A seat is claimed
-- with a secret the client generates and never shows anyone; the player id
-- becomes a server-issued value that is meaningless without that secret, so
-- publishing it on the leaderboard costs nothing.
--
-- Guests still play with no account. That is the point of doing it this way
-- rather than simply requiring login: the secret is per-session and per-device,
-- so nothing has to be signed up for.

create table if not exists public.live_seats (
  code       text not null references public.live_sessions(code) on delete cascade,
  /** the client's secret. Never leaves their device except as an argument. */
  token      text not null check (length(token) >= 16),
  /** what everyone else may see. Server-issued, so it proves nothing. */
  player_id  text not null default gen_random_uuid()::text,
  /** set when the seat was claimed by a signed-in account */
  user_id    uuid references auth.users(id) on delete set null,
  joined_at  timestamptz not null default now(),
  primary key (code, token),
  unique (code, player_id)
);

-- No policies at all: with RLS on, nothing outside the SECURITY DEFINER
-- functions below can read or write a seat.
alter table public.live_seats enable row level security;

-- Both functions keep their argument types, so a plain CREATE OR REPLACE
-- would refuse to rename the parameter. Drop first.
drop function if exists public.live_join(text, text, text);
drop function if exists public.live_answer(text, text, int, text);

/**
 * Claim a seat, or come back to the one this device already holds.
 *
 * Re-joining with the same token is how a page reload keeps its seat. Joining
 * with a *different* token is always a new seat, so nobody can take one over
 * by naming it - there is nothing to name.
 */
create or replace function public.live_join(
  p_code text, p_token text, p_nick text
) returns table (player_id text, phase text, current_idx int, question_count int, title text)
language plpgsql security definer set search_path = public as $$
declare
  v_seat  record;
  v_uid   uuid := auth.uid();
begin
  if length(coalesce(p_token, '')) < 16 then raise exception 'weak seat token'; end if;
  if not exists (select 1 from live_sessions s where s.code = p_code) then
    raise exception 'no such session';
  end if;
  if exists (select 1 from live_sessions s where s.code = p_code and s.phase = 'ended') then
    raise exception 'session ended';
  end if;

  select * into v_seat from live_seats st where st.code = p_code and st.token = p_token;

  if not found then
    insert into live_seats (code, token, user_id) values (p_code, p_token, v_uid)
    returning * into v_seat;
  elsif v_seat.user_id is not null and v_seat.user_id is distinct from v_uid then
    -- a seat owned by an account is that account's, token or not
    raise exception 'seat belongs to another account';
  end if;

  insert into live_players (code, player_id, nickname)
  values (p_code, v_seat.player_id, left(btrim(p_nick), 16))
  on conflict (code, player_id) do update set nickname = excluded.nickname;

  return query
    select v_seat.player_id, s.phase, s.current_idx, s.question_count, s.title
    from live_sessions s where s.code = p_code;
end;
$$;

/** Write-once, for the question on screen, from the seat that holds the token. */
create or replace function public.live_answer(
  p_code text, p_token text, p_idx int, p_choice text
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_s    record;
  v_seat record;
  v_uid  uuid := auth.uid();
begin
  select * into v_s from live_sessions s where s.code = p_code;
  if not found then raise exception 'no such session'; end if;
  if v_s.phase <> 'asking' then raise exception 'not taking answers'; end if;
  if v_s.current_idx <> p_idx then raise exception 'wrong question'; end if;

  select * into v_seat from live_seats st where st.code = p_code and st.token = p_token;
  if not found then raise exception 'not in this session'; end if;
  if v_seat.user_id is not null and v_seat.user_id is distinct from v_uid then
    raise exception 'not your seat';
  end if;

  insert into live_answers (code, idx, player_id, choice, ms)
  values (
    p_code, p_idx, v_seat.player_id, p_choice,
    greatest(0, least(600000, (extract(epoch from (now() - v_s.asked_at)) * 1000)::int))
  )
  on conflict do nothing;
end;
$$;
