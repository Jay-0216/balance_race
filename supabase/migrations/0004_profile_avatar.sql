-- A chosen profile picture.
--
-- Two small columns rather than a storage bucket. An uploaded photo would mean
-- moderation, a storage bill and a privacy question - for an image that renders
-- at 38px next to a nickname. An emoji and a hue carry nothing a stranger
-- should not see, need no bucket, and are eight bytes to sync between devices.
--
-- Null in both means "use the face derived from the account id", which is what
-- every existing row already gets.
alter table public.profiles
  add column if not exists avatar_emoji text,
  add column if not exists avatar_hue   smallint;

-- One grapheme, and a hue that is actually on the wheel. The client already
-- checks both; this is the copy that holds when the client is not the client.
alter table public.profiles drop constraint if exists profiles_avatar_emoji_len;
alter table public.profiles add constraint profiles_avatar_emoji_len
  check (avatar_emoji is null or length(avatar_emoji) between 1 and 8);

alter table public.profiles drop constraint if exists profiles_avatar_hue_range;
alter table public.profiles add constraint profiles_avatar_hue_range
  check (avatar_hue is null or avatar_hue between 0 and 359);

-- The existing profiles_update_own policy (auth.uid() = id) already covers
-- these columns: a policy grants the row, not the column list.
