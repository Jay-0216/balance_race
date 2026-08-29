-- The garage, wallet included, on the account.
--
-- It lived only in localStorage, which was fine while it held a chosen face -
-- and stopped being fine the moment it held money. Clearing site data wiped
-- what you had won, and signing in on a second device showed an empty garage,
-- which is a strange thing for a login to do.
--
-- One jsonb column rather than tables per thing: this is a save file, read and
-- written whole by exactly one owner, never queried across users and never
-- joined. profiles already has profiles_read_own (auth.uid() = id), so it is
-- private to its owner for the same reason the nickname is.
alter table public.profiles add column if not exists garage jsonb;

-- A save file, not a filesystem. Big enough for every piece, paint and stat
-- several times over; far too small to be used as storage.
alter table public.profiles drop constraint if exists profiles_garage_size;
alter table public.profiles add constraint profiles_garage_size
  check (garage is null or length(garage::text) <= 8000);
