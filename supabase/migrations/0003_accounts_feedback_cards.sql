-- Accounts, bug reports, and player-written balance cards.

-- ---------------------------------------------------------------- profiles
-- One row per signed-in account. The nickname lives here rather than in
-- localStorage so it follows you to another device.
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  nickname   text        not null default '나',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Your own row and nobody else's. Other players' nicknames travel through the
-- players table inside a room, which is where they are actually needed.
drop policy if exists profiles_read_own   on public.profiles;
drop policy if exists profiles_write_own  on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_read_own   on public.profiles for select using (auth.uid() = id);
create policy profiles_write_own  on public.profiles for insert with check (auth.uid() = id);
create policy profiles_update_own on public.profiles for update using (auth.uid() = id);

-- ---------------------------------------------------------------- feedback
-- Bug reports and ideas. Write-only from the game: anyone may file one,
-- nobody may read the pile. There is deliberately no select policy, so a
-- report is visible only in the Supabase dashboard - which is the right shape
-- for a form that strangers can reach.
create table if not exists public.feedback (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        references auth.users(id) on delete set null,
  kind       text        not null default 'bug' check (kind in ('bug', 'idea')),
  body       text        not null check (length(btrim(body)) between 5 and 1000),
  contact    text        check (contact is null or length(contact) <= 120),
  context    jsonb       not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

drop policy if exists feedback_file on public.feedback;
create policy feedback_file on public.feedback for insert with check (true);

-- --------------------------------------------------------- card submissions
-- Balance cards written by players. A submitted card is invisible to everyone
-- but its author until it is approved by hand; once approved it is readable by
-- the whole game and joins the deck.
create table if not exists public.card_submissions (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        references auth.users(id) on delete set null,
  author     text,
  category   text        not null default '자유' check (length(category) between 1 and 12),
  a_emoji    text        not null default '🅰️' check (length(a_emoji) <= 8),
  a_text     text        not null check (length(btrim(a_text)) between 2 and 40),
  b_emoji    text        not null default '🅱️' check (length(b_emoji) <= 8),
  b_text     text        not null check (length(btrim(b_text)) between 2 and 40),
  status     text        not null default 'pending'
             check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  -- the same two sides twice is a typo, not a dilemma
  check (btrim(a_text) <> btrim(b_text))
);

create index if not exists card_submissions_approved_idx
  on public.card_submissions (status) where status = 'approved';

alter table public.card_submissions enable row level security;

drop policy if exists cards_submit    on public.card_submissions;
drop policy if exists cards_read_open on public.card_submissions;
create policy cards_submit on public.card_submissions for insert with check (true);
create policy cards_read_open on public.card_submissions
  for select using (status = 'approved' or (user_id is not null and user_id = auth.uid()));
