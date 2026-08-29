-- An uploaded profile picture, stored as a small data URL rather than a file.
--
-- The browser crops it square, scales it to 128px and re-encodes it before it
-- ever leaves the device, so what lands here is a few kilobytes of text - and
-- the re-encode drops the EXIF block where a phone records where a photo was
-- taken.
--
-- No storage bucket, and no moderation surface: `profiles` has only
-- profiles_read_own (auth.uid() = id), so a picture here is visible to exactly
-- one person - the account that chose it. Nobody else can fetch it, and there
-- is no gallery for it to appear in.
alter table public.profiles add column if not exists avatar_photo text;

-- A cap, so one row cannot become a megabyte. 128px WebP at q0.82 is well
-- under 20KB; 300000 characters is a wide margin over that and still far too
-- small to be used as free file storage.
alter table public.profiles drop constraint if exists profiles_avatar_photo_shape;
alter table public.profiles add constraint profiles_avatar_photo_shape
  check (
    avatar_photo is null
    or (avatar_photo like 'data:image/%' and length(avatar_photo) <= 300000)
  );
