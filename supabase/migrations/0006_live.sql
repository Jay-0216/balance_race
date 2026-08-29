-- 라이브 — one host, a code, and as many people as show up.
--
-- The host writes questions (quiz or balance), reads out a code, and watches
-- the answers land. There is no seat limit anywhere in here on purpose: no
-- seat column, no cap, nothing that has to be allocated per player.
--
-- Two rules this schema exists to enforce:
--   1. Nobody can read an answer key before the host reveals it.
--   2. Nobody but the host can advance the session or see the live tally.
--
-- Both are enforced by absent policies plus SECURITY DEFINER functions, not by
-- the client being polite.

-- ------------------------------------------------------------------ sessions
create table if not exists public.live_sessions (
  code           text primary key,
  host_id        text        not null,
  title          text        not null default '라이브',
  phase          text        not null default 'lobby'
                 check (phase in ('lobby', 'asking', 'revealed', 'ended')),
  current_idx    int         not null default 0,
  question_count int         not null default 0,
  -- Set only when phase = 'revealed'. Everyone can read this row, so nothing
  -- in it may give away an answer that has not been revealed yet.
  reveal_choice  text        check (reveal_choice in ('a', 'b')),
  asked_at       timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- The host's bearer secret, in its own table because live_sessions is world
-- readable and RLS is row-level, not column-level. This table has no policies
-- at all, so with RLS on, nothing outside a SECURITY DEFINER function can read
-- or write it.
create table if not exists public.live_secrets (
  code       text primary key references public.live_sessions(code) on delete cascade,
  host_token text not null
);

create table if not exists public.live_questions (
  code    text not null references public.live_sessions(code) on delete cascade,
  idx     int  not null,
  kind    text not null check (kind in ('quiz', 'balance')),
  prompt  text not null check (length(btrim(prompt)) between 1 and 200),
  a_emoji text not null default '🅰️' check (length(a_emoji) <= 8),
  a_text  text not null check (length(btrim(a_text)) between 1 and 60),
  b_emoji text not null default '🅱️' check (length(b_emoji) <= 8),
  b_text  text not null check (length(btrim(b_text)) between 1 and 60),
  -- the answer key; null for a balance question, which has none
  answer  text check (answer in ('a', 'b')),
  note    text check (note is null or length(note) <= 300),
  primary key (code, idx),
  -- a quiz question without an answer is not a quiz question
  check (kind <> 'quiz' or answer is not null)
);

create table if not exists public.live_players (
  code      text        not null references public.live_sessions(code) on delete cascade,
  player_id text        not null,
  nickname  text        not null check (length(btrim(nickname)) between 1 and 16),
  score     int         not null default 0,
  hits      int         not null default 0,
  joined_at timestamptz not null default now(),
  primary key (code, player_id)
);

create index if not exists live_players_board_idx
  on public.live_players (code, score desc, joined_at);

create table if not exists public.live_answers (
  code       text        not null references public.live_sessions(code) on delete cascade,
  idx        int         not null,
  player_id  text        not null,
  choice     text        not null check (choice in ('a', 'b')),
  -- filled in at reveal, not at insert: a balance question's "right" side is
  -- whichever side the room picked, and that is not known until it closes
  correct    boolean,
  ms         int         not null default 0,
  created_at timestamptz not null default now(),
  -- write-once. Changing your mind after watching the counter move is exactly
  -- what this game is about not letting you do.
  primary key (code, idx, player_id)
);

create index if not exists live_answers_q_idx on public.live_answers (code, idx);

-- ---------------------------------------------------------------- row security

alter table public.live_sessions  enable row level security;
alter table public.live_secrets   enable row level security;
alter table public.live_questions enable row level security;
alter table public.live_players   enable row level security;
alter table public.live_answers   enable row level security;

-- The session row is what a player subscribes to, so it must be readable - and
-- it is safe to read, because the only thing in it that could give an answer
-- away (reveal_choice) is null until the host reveals.
drop policy if exists live_sessions_read on public.live_sessions;
create policy live_sessions_read on public.live_sessions for select using (true);

-- The leaderboard is meant to be seen by the room.
drop policy if exists live_players_read on public.live_players;
create policy live_players_read on public.live_players for select using (true);

-- live_secrets, live_questions and live_answers get NO policies whatsoever.
-- With RLS enabled that means every direct read and write returns nothing or
-- fails: the answer key and the running tally are reachable only through the
-- functions below, which check who is asking.

-- ------------------------------------------------------------------ functions

create or replace function public.live_is_host(p_code text, p_token text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from live_secrets
    where code = p_code and host_token = p_token
  );
$$;

create or replace function public.live_create(
  p_code text, p_host text, p_token text, p_title text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if length(coalesce(p_token, '')) < 16 then
    raise exception 'weak host token';
  end if;
  insert into live_sessions (code, host_id, title)
  values (p_code, p_host, coalesce(nullif(btrim(p_title), ''), '라이브'));
  insert into live_secrets (code, host_token) values (p_code, p_token);
end;
$$;

/** Questions can only be written while the session has not started. */
create or replace function public.live_set_questions(
  p_code text, p_token text, p_questions jsonb
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phase text;
  v_n     int;
begin
  if not live_is_host(p_code, p_token) then raise exception 'not the host'; end if;

  select phase into v_phase from live_sessions where code = p_code;
  if v_phase is null then raise exception 'no such session'; end if;
  if v_phase <> 'lobby' then raise exception 'already started'; end if;

  v_n := jsonb_array_length(p_questions);
  if v_n < 1 or v_n > 50 then raise exception 'between 1 and 50 questions'; end if;

  delete from live_questions where code = p_code;
  insert into live_questions (code, idx, kind, prompt, a_emoji, a_text, b_emoji, b_text, answer, note)
  select
    p_code,
    (ord - 1)::int,
    q ->> 'kind',
    q ->> 'prompt',
    coalesce(q ->> 'a_emoji', '🅰️'),
    q ->> 'a_text',
    coalesce(q ->> 'b_emoji', '🅱️'),
    q ->> 'b_text',
    nullif(q ->> 'answer', ''),
    nullif(q ->> 'note', '')
  from jsonb_array_elements(p_questions) with ordinality as t(q, ord);

  update live_sessions set question_count = v_n, updated_at = now() where code = p_code;
  return v_n;
end;
$$;

/** Anyone with the code may join, as many as turn up. */
create or replace function public.live_join(
  p_code text, p_player text, p_nick text
) returns table (phase text, current_idx int, question_count int, title text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from live_sessions s where s.code = p_code) then
    raise exception 'no such session';
  end if;
  if exists (select 1 from live_sessions s where s.code = p_code and s.phase = 'ended') then
    raise exception 'session ended';
  end if;

  insert into live_players (code, player_id, nickname)
  values (p_code, p_player, left(btrim(p_nick), 16))
  on conflict (code, player_id) do update set nickname = excluded.nickname;

  return query
    select s.phase, s.current_idx, s.question_count, s.title
    from live_sessions s where s.code = p_code;
end;
$$;

/**
 * The current question as a *player* is allowed to see it.
 *
 * The answer and the explanation come back only once the host has revealed,
 * which is the whole reason this is a function and live_questions has no
 * select policy.
 */
create or replace function public.live_current(p_code text)
returns table (
  idx int, kind text, prompt text,
  a_emoji text, a_text text, b_emoji text, b_text text,
  answer text, note text, phase text, question_count int, title text
)
language plpgsql
security definer
set search_path = public
as $$
declare v_s record;
begin
  select * into v_s from live_sessions s where s.code = p_code;
  if not found then raise exception 'no such session'; end if;

  return query
    select
      q.idx, q.kind, q.prompt,
      q.a_emoji, q.a_text, q.b_emoji, q.b_text,
      case when v_s.phase = 'revealed' then q.answer end,
      case when v_s.phase = 'revealed' then q.note end,
      v_s.phase, v_s.question_count, v_s.title
    from live_questions q
    where q.code = p_code and q.idx = v_s.current_idx;
end;
$$;

/** Write-once, and only for the question actually on screen. */
create or replace function public.live_answer(
  p_code text, p_player text, p_idx int, p_choice text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_s record;
begin
  select * into v_s from live_sessions s where s.code = p_code;
  if not found then raise exception 'no such session'; end if;
  if v_s.phase <> 'asking' then raise exception 'not taking answers'; end if;
  if v_s.current_idx <> p_idx then raise exception 'wrong question'; end if;
  if not exists (select 1 from live_players lp where lp.code = p_code and lp.player_id = p_player) then
    raise exception 'not in this session';
  end if;

  insert into live_answers (code, idx, player_id, choice, ms)
  values (
    p_code, p_idx, p_player, p_choice,
    -- epoch, not milliseconds: extract(milliseconds ...) on an interval only
    -- reports the seconds field, so anything left open past a minute would
    -- come back as a fraction of a second and score a full speed bonus
    greatest(0, least(600000, (extract(epoch from (now() - v_s.asked_at)) * 1000)::int))
  )
  on conflict do nothing;      -- a second answer is simply ignored
end;
$$;

/**
 * The host moves the session on.
 *
 * Revealing is where scoring happens, because a balance question has no right
 * answer until the room has picked one: the majority side IS the answer. A
 * dead-even split scores nobody, which is the same call the race makes.
 */
create or replace function public.live_advance(
  p_code text, p_token text, p_to text, p_idx int
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind   text;
  v_key    text;
  v_a      int;
  v_b      int;
begin
  if not live_is_host(p_code, p_token) then raise exception 'not the host'; end if;
  if p_to not in ('asking', 'revealed', 'ended') then raise exception 'bad phase'; end if;

  if p_to = 'ended' then
    update live_sessions set phase = 'ended', updated_at = now() where code = p_code;
    return;
  end if;

  if p_to = 'asking' then
    if not exists (select 1 from live_questions q where q.code = p_code and q.idx = p_idx) then
      raise exception 'no such question';
    end if;
    update live_sessions
       set phase = 'asking', current_idx = p_idx, reveal_choice = null,
           asked_at = now(), updated_at = now()
     where code = p_code;
    return;
  end if;

  -- revealing
  select kind, answer into v_kind, v_key
    from live_questions q where q.code = p_code and q.idx = p_idx;
  if v_kind is null then raise exception 'no such question'; end if;

  if v_kind = 'balance' then
    select
      count(*) filter (where choice = 'a'),
      count(*) filter (where choice = 'b')
      into v_a, v_b
      from live_answers where code = p_code and idx = p_idx;
    v_key := case when v_a > v_b then 'a' when v_b > v_a then 'b' else null end;
  end if;

  update live_answers
     set correct = (v_key is not null and choice = v_key)
   where code = p_code and idx = p_idx;

  -- 100 for being right, plus up to 50 for being quick about it
  update live_players lp
     set score = lp.score + 100 + greatest(0, 50 - (a.ms / 400))::int,
         hits  = lp.hits + 1
    from live_answers a
   where a.code = p_code and a.idx = p_idx and a.correct
     and lp.code = p_code and lp.player_id = a.player_id;

  update live_sessions
     set phase = 'revealed', current_idx = p_idx, reveal_choice = v_key, updated_at = now()
   where code = p_code;
end;
$$;

/**
 * What the host watches: how many have answered, and which way. Host only,
 * because during 'asking' this is exactly the thing nobody else may see.
 */
create or replace function public.live_board(p_code text, p_token text)
returns table (answered int, count_a int, count_b int, players int)
language plpgsql
security definer
set search_path = public
as $$
declare v_idx int;
begin
  if not live_is_host(p_code, p_token) then raise exception 'not the host'; end if;
  select current_idx into v_idx from live_sessions where code = p_code;

  return query
    select
      (select count(*)::int from live_answers where code = p_code and idx = v_idx),
      (select count(*)::int from live_answers where code = p_code and idx = v_idx and choice = 'a'),
      (select count(*)::int from live_answers where code = p_code and idx = v_idx and choice = 'b'),
      (select count(*)::int from live_players where code = p_code);
end;
$$;

/** The split, once it is public. Refuses while the question is still open. */
create or replace function public.live_tally(p_code text)
returns table (count_a int, count_b int, answered int)
language plpgsql
security definer
set search_path = public
as $$
declare v_s record;
begin
  select * into v_s from live_sessions s where s.code = p_code;
  if not found then raise exception 'no such session'; end if;
  if v_s.phase <> 'revealed' then raise exception 'not revealed yet'; end if;

  return query
    select
      (select count(*)::int from live_answers a where a.code = p_code and a.idx = v_s.current_idx and a.choice = 'a'),
      (select count(*)::int from live_answers a where a.code = p_code and a.idx = v_s.current_idx and a.choice = 'b'),
      (select count(*)::int from live_answers a where a.code = p_code and a.idx = v_s.current_idx);
end;
$$;

/**
 * Top of the board plus where I am on it.
 *
 * A "no limit" room means the leaderboard can be hundreds of rows, and nobody
 * needs to download all of them to see that they are 47th - so the top comes
 * back capped and my own row comes back regardless of rank.
 */
create or replace function public.live_scores(p_code text, p_player text, p_top int default 10)
returns table (player_id text, nickname text, score int, hits int, rank int, is_me boolean)
language sql
security definer
set search_path = public
as $$
  with ranked as (
    select
      lp.player_id, lp.nickname, lp.score, lp.hits,
      rank() over (order by lp.score desc)::int as rank
    from live_players lp
    where lp.code = p_code
  )
  select r.player_id, r.nickname, r.score, r.hits, r.rank,
         (r.player_id = p_player) as is_me
  from ranked r
  where r.rank <= greatest(1, least(50, p_top)) or r.player_id = p_player
  order by r.rank, r.nickname;
$$;

/**
 * The host's own questions, answers included.
 *
 * Nobody has a select policy on live_questions - not even the host - so a
 * reload would otherwise strand them running a session whose questions they
 * can no longer read. This is the way back in, and it checks the token.
 */
create or replace function public.live_host_questions(p_code text, p_token text)
returns table (
  idx int, kind text, prompt text,
  a_emoji text, a_text text, b_emoji text, b_text text,
  answer text, note text
) language plpgsql security definer set search_path = public as $$
begin
  if not live_is_host(p_code, p_token) then raise exception 'not the host'; end if;
  return query
    select q.idx, q.kind, q.prompt, q.a_emoji, q.a_text, q.b_emoji, q.b_text, q.answer, q.note
    from live_questions q where q.code = p_code order by q.idx;
end;
$$;

-- The session row and the player list are what clients subscribe to. Answers
-- and questions are deliberately NOT published: realtime respects RLS, but not
-- publishing them at all means there is nothing to get wrong.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'live_sessions'
  ) then
    alter publication supabase_realtime add table public.live_sessions;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'live_players'
  ) then
    alter publication supabase_realtime add table public.live_players;
  end if;
end $$;
